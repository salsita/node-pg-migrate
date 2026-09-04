import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  cleanupDatabase,
  exec,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  psqlSelect,
  setupPostgresDatabase,
} from './utils';

const MIGRATIONS_DIR = 'test/dry-run-migrations';
const DIRECT_WRITE_DIR = 'test/dry-run-direct-write';

const TABLE_NAMES =
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";

describe.each(PG_VERSIONS)(
  'node-pg-migrate --dry-run (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
      pgContainer = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`,
        `test_dry_run_pg_${postgresVersion}`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    afterEach(async () => {
      await cleanupDatabase(pgContainer);
    });

    function migrate(
      args: string
    ): Promise<{ stdout: string; stderr: string }> {
      return exec(`node bin/node-pg-migrate.js ${args}`, {
        env: {
          ...process.env,
          DATABASE_URL: pgContainer.getConnectionUri(),
        },
      });
    }

    it('creates nothing on a clean database', async ({ expect }) => {
      const { stdout } = await migrate(`up -m ${MIGRATIONS_DIR} --dry-run`);

      expect(stdout).toContain('CREATE TABLE "dry_run_table"');
      expect(stdout).toContain('Dry run complete!');
      // Not even the migrations table - a dry run that provisions objects is not dry.
      await expect(psqlSelect(pgContainer, TABLE_NAMES)).resolves.toEqual([]);
    });

    it('records nothing when combined with --fake', async ({ expect }) => {
      const { stdout } = await migrate(
        `up -m ${MIGRATIONS_DIR} --fake --dry-run`
      );

      expect(stdout).toContain('INSERT INTO "public"."pgmigrations"');
      await expect(psqlSelect(pgContainer, TABLE_NAMES)).resolves.toEqual([]);
    });

    it('leaves applied migrations in place on a dry down', async ({
      expect,
    }) => {
      await migrate(`up -m ${MIGRATIONS_DIR}`);

      const { stdout } = await migrate(`down 0 -m ${MIGRATIONS_DIR} --dry-run`);

      expect(stdout).toContain('DROP TABLE "dry_run_table"');
      await expect(psqlSelect(pgContainer, TABLE_NAMES)).resolves.toEqual([
        'dry_run_table',
        'pgmigrations',
      ]);
      await expect(
        psqlSelect(pgContainer, 'SELECT name FROM pgmigrations')
      ).resolves.toEqual(['1000_dry_run_table']);
    });

    it('refuses a migration that writes to the database directly', async ({
      expect,
    }) => {
      // The generated SQL is never executed in a dry run, but a migration can reach past
      // the builder. The read-only transaction is what stops it, so this must fail rather
      // than silently apply.
      await expect(
        migrate(`up -m ${DIRECT_WRITE_DIR} --dry-run`)
      ).rejects.toThrow(
        'This migration writes to the database directly (e.g. through `pgm.db.query(...)`)'
      );

      await expect(psqlSelect(pgContainer, TABLE_NAMES)).resolves.toEqual([]);
    });

    it('applies the same migrations normally afterwards', async ({
      expect,
    }) => {
      await migrate(`up -m ${MIGRATIONS_DIR} --dry-run`);

      const { stdout } = await migrate(`up -m ${MIGRATIONS_DIR}`);

      expect(stdout).toContain('Migrations complete!');
      await expect(psqlSelect(pgContainer, TABLE_NAMES)).resolves.toEqual([
        'dry_run_table',
        'pgmigrations',
      ]);
    });
  }
);
