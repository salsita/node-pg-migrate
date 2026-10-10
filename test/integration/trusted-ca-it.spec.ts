import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { RunnerOption } from '../../src';
import { runner } from '../../src';
import { INTEGRATION_TIMEOUT, PG_VERSIONS } from './utils';

// execFile returns a ChildProcess, matching Node's promisify convention.
// oxlint-disable-next-line typescript/strict-void-return
const execute = promisify(execFile);
const binary = resolve('bin/node-pg-migrate.js');
const migrationName = '1000000000000_VerifiedTLS';
const certificateError =
  /self-signed certificate|unable to verify|unable to get local issuer/i;

async function createCertificates(dir: string) {
  const caFile = join(dir, 'root CA.crt');
  const caKey = join(dir, 'root-ca.key');
  const certFile = join(dir, 'server.crt');
  const keyFile = join(dir, 'server.key');
  const requestFile = join(dir, 'server.csr');
  const extensionsFile = join(dir, 'server.ext');
  const wrongCaFile = join(dir, 'wrong-ca.crt');

  for (const [certificate, key, name] of [
    [caFile, caKey, 'Migration Test Root CA'],
    [wrongCaFile, join(dir, 'wrong-ca.key'), 'Unrelated Test Root CA'],
  ]) {
    await execute('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '2',
      '-subj',
      `/CN=${name}`,
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
      '-keyout',
      key,
      '-out',
      certificate,
    ]);
  }
  await execute('openssl', [
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-subj',
    '/CN=localhost',
    '-keyout',
    keyFile,
    '-out',
    requestFile,
  ]);
  await writeFile(
    extensionsFile,
    [
      'basicConstraints=critical,CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
    ].join('\n')
  );
  await execute('openssl', [
    'x509',
    '-req',
    '-in',
    requestFile,
    '-CA',
    caFile,
    '-CAkey',
    caKey,
    '-CAcreateserial',
    '-days',
    '2',
    '-sha256',
    '-extfile',
    extensionsFile,
    '-out',
    certFile,
  ]);
  return { caFile, certFile, keyFile, wrongCaFile };
}

describe.each(PG_VERSIONS)(
  'trusted TLS CA (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (version) => {
    let container: StartedPostgreSqlContainer;
    let client: pg.Client;
    let certificateDir: string;
    let dir: string;
    let caFile: string;
    let wrongCaFile: string;
    let ca: string;
    let wrongCa: string;
    let options: RunnerOption;

    beforeAll(async () => {
      certificateDir = await mkdtemp(join(tmpdir(), 'pgm-trusted-ca-'));
      const certificates = await createCertificates(certificateDir);
      ({ caFile, wrongCaFile } = certificates);
      ca = await readFile(caFile, 'utf8');
      wrongCa = await readFile(wrongCaFile, 'utf8');
      container = await new PostgreSqlContainer(`postgres:${version}-alpine`)
        .withUsername('ubuntu')
        .withPassword('ubuntu')
        .withDatabase('trusted_ca')
        .withSSL(certificates.certFile, certificates.keyFile, caFile)
        .withCopyContentToContainer([
          {
            target: '/docker-entrypoint-initdb.d/require-tls.sh',
            mode: 0o755,
            content: `#!/bin/sh
set -eu
cat > "$PGDATA/pg_hba.conf" <<'EOF'
local all all trust
hostssl all all all scram-sha-256
hostnossl all all all reject
EOF
`,
          },
        ])
        .start();
      client = new pg.Client({
        connectionString: container.getConnectionUri(),
        ssl: { ca, rejectUnauthorized: true },
      });
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (container) {
        await container.stop();
      }
      if (certificateDir) {
        await rm(certificateDir, { recursive: true, force: true });
      }
    });

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pgm-tls-migrations-'));
      await mkdir(join(dir, 'migrations'));
      await writeFile(
        join(dir, 'migrations', `${migrationName}.sql`),
        `-- Up Migration
CREATE TABLE trusted_ca.session_security AS
SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();
-- Down Migration
DROP TABLE trusted_ca.session_security;
`
      );
      await client.query('CREATE SCHEMA trusted_ca');
      options = {
        direction: 'up',
        databaseUrl: {
          connectionString: container.getConnectionUri(),
          ssl: { ca, rejectUnauthorized: true },
        },
        dir: join(dir, 'migrations'),
        schema: 'trusted_ca',
        migrationsSchema: 'trusted_ca',
        migrationsTable: 'pgmigrations',
        log: () => {},
      };
    });

    afterEach(async () => {
      try {
        await client.query('DROP SCHEMA IF EXISTS trusted_ca CASCADE');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    function urlWithCa(path: string) {
      const url = new URL(container.getConnectionUri());
      url.searchParams.set('sslmode', 'verify-full');
      url.searchParams.set('sslrootcert', path);
      return url.toString();
    }

    function runCli(
      direction: 'up' | 'down',
      databaseUrl: string,
      configFile?: string
    ) {
      const env: NodeJS.ProcessEnv = { ...process.env };
      for (const name of Object.keys(env)) {
        if (
          name.startsWith('PG') ||
          name === 'DATABASE_URL' ||
          name === 'NODE_TLS_REJECT_UNAUTHORIZED'
        ) {
          delete env[name];
        }
      }
      env.DATABASE_URL = databaseUrl;
      return execute(
        process.execPath,
        [
          binary,
          direction,
          '--migrations-dir',
          join(dir, 'migrations'),
          '--schema',
          'trusted_ca',
          '--migrations-schema',
          'trusted_ca',
          ...(configFile ? ['--config-file', configFile] : []),
        ],
        { cwd: dir, env }
      );
    }

    async function assertApplied() {
      expect(
        (await client.query('SELECT ssl FROM trusted_ca.session_security')).rows
      ).toEqual([{ ssl: true }]);
      expect(
        (await client.query('SELECT name FROM trusted_ca.pgmigrations')).rows
      ).toEqual([{ name: migrationName }]);
    }

    async function assertReverted() {
      expect(
        (
          await client.query(
            "SELECT to_regclass('trusted_ca.session_security') AS relation"
          )
        ).rows
      ).toEqual([{ relation: null }]);
      expect(
        (await client.query('SELECT name FROM trusted_ca.pgmigrations')).rows
      ).toEqual([]);
    }

    it('runs with a verified CA in the programmatic ClientConfig', async () => {
      await runner(options);
      await assertApplied();
      await runner({ ...options, direction: 'down' });
      await assertReverted();
    });

    it('runs the CLI with a URL-encoded sslrootcert path', async () => {
      const url = urlWithCa(caFile);
      expect(url).toContain('root+CA.crt');
      await runCli('up', url);
      await assertApplied();
      await runCli('down', url);
      await assertReverted();
    });

    it.each(['mjs', 'ts'])(
      'runs the documented %s CLI configuration with DATABASE_URL set',
      async (extension) => {
        const path = join(dir, `migrations.config.${extension}`);
        await writeFile(
          path,
          `import { readFileSync } from 'node:fs';
export default {
  'database-url-var': {
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync(${JSON.stringify(caFile)}, 'utf8'), rejectUnauthorized: true },
  },
};
`
        );
        await runCli('up', container.getConnectionUri(), path);
        await assertApplied();
        await runCli('down', container.getConnectionUri(), path);
        await assertReverted();
      }
    );

    it.each(['missing', 'wrong'])(
      'rejects a %s CA with verification enabled',
      async (kind) => {
        await expect(
          runner({
            ...options,
            databaseUrl: {
              connectionString: container.getConnectionUri(),
              ssl: {
                rejectUnauthorized: true,
                ...(kind === 'wrong' ? { ca: wrongCa } : {}),
              },
            },
          })
        ).rejects.toThrow(certificateError);
      }
    );

    it('refuses plaintext connections on the TLS-only test server', async () => {
      await expect(
        runner({
          ...options,
          databaseUrl: {
            connectionString: container.getConnectionUri(),
            ssl: false,
          },
        })
      ).rejects.toThrow(/pg_hba.conf rejects connection.*no encryption/);
    });

    it('demonstrates that URL TLS settings replace an explicit CA object', async () => {
      const url = new URL(container.getConnectionUri());
      url.searchParams.set('sslmode', 'verify-full');
      await expect(
        runner({
          ...options,
          databaseUrl: {
            connectionString: url.toString(),
            ssl: { ca, rejectUnauthorized: true },
          },
        })
      ).rejects.toThrow(certificateError);
    });

    it('rejects the CLI URL when sslrootcert trusts an unrelated CA', async () => {
      await expect(runCli('up', urlWithCa(wrongCaFile))).rejects.toThrow(
        certificateError
      );
    });
  }
);
