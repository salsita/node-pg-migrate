import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';
import type { CliResult } from './utils';
import {
  createDatabase,
  databaseUrl,
  loadSql,
  PG_VERSIONS,
  runCli,
  setupPostgresDatabase,
} from './utils';

// pg_dump has to trust the server the way node-postgres does: with the root
// certificate of the connection string, or with the user's own libpq SSL
// settings when the connection comes from the libpq environment variables.

/**
 * A table to dump, so that every database has something in its baseline.
 */
const WIDGETS =
  'CREATE TABLE public.widgets (id integer PRIMARY KEY, name text NOT NULL);';

/**
 * Where the server's certificate and key go inside the container.
 */
const SERVER_CERT = '/var/lib/postgresql/pgm-server.crt';
const SERVER_KEY = '/var/lib/postgresql/pgm-server.key';

/**
 * How long the server may take to turn SSL on after reloading its
 * configuration.
 */
const SSL_ON_TIMEOUT_MS = 10_000;

/**
 * Makes a self-signed certificate for `localhost` and the host the tests
 * reach the container at, with the `openssl` of this machine. Clients that
 * trust it as a root certificate can verify the server's name.
 *
 * @param dir Where to write the certificate and its key.
 * @param host The host the tests reach the container at.
 *
 * @returns The paths of the certificate and of the key.
 */
function selfSignedCertificate(
  dir: string,
  host: string
): { readonly cert: string; readonly key: string } {
  const cert = join(dir, 'root.crt');
  const key = join(dir, 'server.key');
  const names = new Set([
    'DNS:localhost',
    'IP:127.0.0.1',
    isIP(host) === 0 ? `DNS:${host}` : `IP:${host}`,
  ]);
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '2',
      '-subj',
      '/CN=localhost',
      '-addext',
      `subjectAltName=${[...names].join(',')}`,
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'pipe' }
  );

  return { cert, key };
}

/**
 * Runs a query with `psql` inside the container, through its socket.
 *
 * @param container The PostgreSQL container.
 * @param sql The query.
 *
 * @returns The rows, one line each (`psql -At`).
 */
async function query(
  container: StartedPostgreSqlContainer,
  sql: string
): Promise<string[]> {
  const res = await container.exec([
    'psql',
    '-X',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    container.getUsername(),
    '-d',
    container.getDatabase(),
    '-c',
    sql,
  ]);
  if (res.exitCode !== 0) {
    throw new Error(`query failed: ${res.stderr}`);
  }

  return res.stdout.split('\n').filter(Boolean);
}

/**
 * Turns SSL on in the server of the container, with a certificate and its
 * key, and waits until new connections can use it.
 *
 * @param container The PostgreSQL container.
 * @param certificate The paths of the certificate and of its key.
 * @param certificate.cert The certificate.
 * @param certificate.key Its key.
 */
async function enableSsl(
  container: StartedPostgreSqlContainer,
  certificate: { readonly cert: string; readonly key: string }
): Promise<void> {
  await container.copyContentToContainer([
    {
      content: await readFile(certificate.cert, 'utf8'),
      target: SERVER_CERT,
      mode: 0o644,
    },
    {
      content: await readFile(certificate.key, 'utf8'),
      target: SERVER_KEY,
      mode: 0o600,
    },
  ]);
  const chown = await container.exec([
    'chown',
    'postgres:postgres',
    SERVER_CERT,
    SERVER_KEY,
  ]);
  if (chown.exitCode !== 0) {
    throw new Error(`chown failed: ${chown.output}`);
  }

  await query(container, `ALTER SYSTEM SET ssl_cert_file = '${SERVER_CERT}'`);
  await query(container, `ALTER SYSTEM SET ssl_key_file = '${SERVER_KEY}'`);
  await query(container, 'ALTER SYSTEM SET ssl = on');
  await query(container, 'SELECT pg_reload_conf()');

  const deadline = Date.now() + SSL_ON_TIMEOUT_MS;
  while ((await query(container, 'SHOW ssl'))[0] !== 'on') {
    if (Date.now() > deadline) {
      throw new Error('the server did not turn SSL on');
    }

    await sleep(100);
  }
}

/**
 * Writes a pg_dump shim that runs the pg_dump inside the container over TCP
 * to `localhost`, so that libpq negotiates SSL with the settings it gets:
 * the credentials and the libpq SSL variables are passed on, the host and
 * port are the server's own.
 *
 * @param container The PostgreSQL container.
 * @param dir Where to write the shim.
 *
 * @returns The path of the shim.
 */
async function sslPgDumpShim(
  container: StartedPostgreSqlContainer,
  dir: string
): Promise<string> {
  const path = join(dir, 'pg_dump');
  await writeFile(
    path,
    [
      '#!/bin/sh',
      `exec docker exec -i -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE -e PGSSLROOTCERT -e PGSSLCERT -e PGSSLKEY -e PGSSLCRL -e PGHOST=localhost -e PGPORT=5432 ${container.getId()} pg_dump "$@"`,
      '',
    ].join('\n'),
    { mode: 0o755 }
  );

  return path;
}

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-e2e-baseline-ssl-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Checks that a `baseline` run succeeded: exit code 0, and one SQL migration
 * in `<cwd>/migrations` that creates the widgets table.
 *
 * @param result The `baseline` run, with `-m migrations`.
 * @param cwd The directory it ran in.
 */
async function expectWidgetsBaseline(
  result: CliResult,
  cwd: string
): Promise<void> {
  expect(result.code, result.stderr).toBe(0);

  const dir = join(cwd, 'migrations');
  const files = await readdir(dir);
  expect(files).toEqual([expect.stringMatching(/^\d+_baseline\.sql$/)]);
  expect(await readFile(join(dir, files[0]), 'utf8')).toContain(
    'CREATE TABLE public.widgets'
  );
}

describe.each(PG_VERSIONS)(
  'baseline with pg_dump over SSL (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let certDir: string;
    let rootCert: string;
    let pgDump: string;
    let databaseCount = 0;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
      certDir = await mkdtemp(join(tmpdir(), 'pgm-e2e-ssl-'));
      const certificate = selfSignedCertificate(certDir, container.getHost());
      rootCert = certificate.cert;
      await enableSsl(container, certificate);
      // The pg_dump inside the container finds the root certificate at the
      // path the connection gives, like a pg_dump on this machine would.
      await container.copyContentToContainer([
        { content: await readFile(rootCert, 'utf8'), target: rootCert },
      ]);
      pgDump = await sslPgDumpShim(container, certDir);
    });

    afterAll(async () => {
      await container?.stop();
      if (certDir) {
        await rm(certDir, { recursive: true, force: true });
      }
    });

    /**
     * Creates a database with the widgets table.
     *
     * @returns Its name.
     */
    async function widgetsDatabase(): Promise<string> {
      databaseCount += 1;
      const name = `ssl_${databaseCount}`;
      await createDatabase(container, name);
      await loadSql(container, name, WIDGETS);

      return name;
    }

    it('gives pg_dump the root certificate of a verify-full connection string', async () => {
      const database = await widgetsDatabase();
      const cwd = await tempDir();
      const url = `${databaseUrl(container, database)}?sslmode=verify-full&sslrootcert=${encodeURIComponent(rootCert)}`;

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, '-m', 'migrations'],
        { cwd, env: { DATABASE_URL: url } }
      );

      await expectWidgetsBaseline(result, cwd);
    });

    it("keeps the user's PGSSLMODE=require for pg_dump when the connection comes from the libpq variables", async () => {
      const database = await widgetsDatabase();
      const cwd = await tempDir();

      const result = await runCli(
        ['baseline', '--pg-dump', pgDump, '-m', 'migrations'],
        {
          cwd,
          env: {
            DATABASE_URL: undefined,
            PGHOST: container.getHost(),
            PGPORT: String(container.getPort()),
            PGUSER: container.getUsername(),
            PGPASSWORD: container.getPassword(),
            PGDATABASE: database,
            PGSSLMODE: 'require',
            PGSSLROOTCERT: undefined,
            // node-postgres verifies the certificate, like it would one of a
            // public certificate authority.
            NODE_EXTRA_CA_CERTS: rootCert,
          },
        }
      );

      await expectWidgetsBaseline(result, cwd);
    });
  }
);
