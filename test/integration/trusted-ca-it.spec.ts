import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
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
import type { TlsCertificates } from './tls-fixtures';
import {
  createTlsCertificates,
  setupTlsPostgresDatabase,
} from './tls-fixtures';
import { INTEGRATION_TIMEOUT, PG_VERSIONS } from './utils';

// execFile returns a ChildProcess, matching Node's promisify convention.
// oxlint-disable-next-line typescript/strict-void-return
const execute = promisify(execFile);
const binary = resolve('bin/node-pg-migrate.js');
const migrationName = '1000000000000_VerifiedTLS';
const certificateError =
  /self-signed certificate|unable to verify|unable to get local issuer/i;

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
    let certificates: TlsCertificates;

    beforeAll(async () => {
      certificateDir = await mkdtemp(join(tmpdir(), 'pgm-trusted-ca-'));
      certificates = await createTlsCertificates(certificateDir);
      ({ caFile, wrongCaFile } = certificates);
      ca = await readFile(caFile, 'utf8');
      wrongCa = await readFile(wrongCaFile, 'utf8');
      container = await setupTlsPostgresDatabase(version, certificates);
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
      configFile?: string,
      extraArgs: string[] = []
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
          ...extraArgs,
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

    it('rejects a trusted server certificate with a mismatched hostname', async () => {
      const mismatched = await setupTlsPostgresDatabase(
        version,
        certificates,
        true
      );
      try {
        await expect(
          runner({
            ...options,
            databaseUrl: {
              connectionString: mismatched.getConnectionUri(),
              ssl: { ca, rejectUnauthorized: true },
            },
          })
        ).rejects.toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
      } finally {
        await mismatched.stop();
      }
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

    it('keeps URL certificate verification despite --no-reject-unauthorized', async () => {
      await expect(
        runCli('up', urlWithCa(wrongCaFile), undefined, [
          '--no-reject-unauthorized',
        ])
      ).rejects.toThrow(certificateError);
    });

    it('disables explicit-object verification with --no-reject-unauthorized', async () => {
      const path = join(dir, 'unverified.config.mjs');
      await writeFile(
        path,
        `import { readFileSync } from 'node:fs';
export default {
  'database-url-var': {
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync(${JSON.stringify(wrongCaFile)}, 'utf8'), rejectUnauthorized: true },
  },
};
`
      );
      await expect(
        runCli('up', container.getConnectionUri(), path)
      ).rejects.toThrow(certificateError);
      await runCli('up', container.getConnectionUri(), path, [
        '--no-reject-unauthorized',
      ]);
      await assertApplied();
      await runCli('down', container.getConnectionUri(), path, [
        '--no-reject-unauthorized',
      ]);
      await assertReverted();
    });
  }
);
