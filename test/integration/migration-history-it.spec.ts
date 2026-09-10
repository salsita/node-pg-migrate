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

const MIGRATIONS_DIR = 'test/migration-history';

const TABLES =
  "SELECT n.nspname || '.' || c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_toast%' ORDER BY 1";

const SCHEMAS =
  "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' ORDER BY 1";

describe.each(PG_VERSIONS)(
  'node-pg-migrate migration history (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;

    beforeAll(async () => {
      pgContainer = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`,
        `test_migration_history_pg_${postgresVersion}`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    afterEach(async () => {
      await psqlSelect(
        pgContainer,
        `ALTER ROLE ${pgContainer.getUsername()} IN DATABASE ${pgContainer.getDatabase()} RESET search_path`
      );
      await cleanupDatabase(pgContainer);
    });

    function migrate(
      args: string,
      databaseUrl = pgContainer.getConnectionUri()
    ): Promise<{ stdout: string; stderr: string }> {
      return exec(`node bin/node-pg-migrate.js ${args} -m ${MIGRATIONS_DIR}`, {
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    }

    async function snapshot(): Promise<string[]> {
      return [
        ...(await psqlSelect(pgContainer, TABLES)),
        ...(await psqlSelect(pgContainer, SCHEMAS)),
      ];
    }

    it('refuses to replay a history that the role search_path points at', async ({
      expect,
    }) => {
      // The reporter's setup: psql and pgAdmin resolve everything in "app", while the CLI
      // falls back to --schema public.
      await migrate('up 1 -s app --create-schema');
      await psqlSelect(
        pgContainer,
        `ALTER ROLE ${pgContainer.getUsername()} IN DATABASE ${pgContainer.getDatabase()} SET search_path = app`
      );
      const before = await snapshot();

      for (const args of ['up', 'up --dry-run', 'up --fake', 'down', 'redo']) {
        await expect(migrate(args)).rejects.toThrow(
          'Refusing to run: the migrations table "public"."pgmigrations" does not exist, but "app"."pgmigrations" already records migrations.'
        );
      }

      await expect(snapshot()).resolves.toEqual(before);

      const { stdout } = await migrate('up -s app');

      expect(stdout).toContain('> - 1001_users_contract');
      await expect(
        psqlSelect(pgContainer, 'SELECT name FROM app.pgmigrations ORDER BY id')
      ).resolves.toEqual(['1000_users', '1001_users_contract']);
    });

    it('refuses when --schema is dropped, even when an empty migrations table is left behind', async ({
      expect,
    }) => {
      await migrate('up 1 -s app --create-schema');
      await psqlSelect(
        pgContainer,
        'CREATE TABLE public.pgmigrations (id serial PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );

      await expect(migrate('up --create-schema')).rejects.toThrow(
        'the migrations table "public"."pgmigrations" is empty, but "app"."pgmigrations" already records migrations.'
      );
      await expect(
        psqlSelect(pgContainer, 'SELECT count(*) FROM public.pgmigrations')
      ).resolves.toEqual(['0']);
    });

    it('refuses a reordered schema list without creating anything', async ({
      expect,
    }) => {
      await migrate('up 1 -s app public --create-schema');
      const before = await snapshot();

      await expect(
        migrate('up -s public app extra --create-schema --no-lock')
      ).rejects.toThrow(
        'To continue that history, pass `--migrations-schema app` (or list "app" first)'
      );
      await expect(snapshot()).resolves.toEqual(before);

      await expect(
        migrate('up -s public app --migrations-schema app')
      ).resolves.toMatchObject({
        stdout: expect.stringContaining('> - 1001_users_contract'),
      });
    });

    it('keeps migrating one schema per tenant', async ({ expect }) => {
      await migrate('up -s tenant_a --create-schema');
      await migrate('up -s tenant_b --create-schema --no-single-transaction');
      await migrate('up -s public');
      await migrate('down 0 -s tenant_b');
      await migrate('up -s tenant_b');

      for (const schema of ['tenant_a', 'tenant_b', 'public']) {
        await expect(
          psqlSelect(pgContainer, `SELECT count(*) FROM ${schema}.pgmigrations`)
        ).resolves.toEqual(['2']);
      }
    });

    it('addresses the migrations table by its configured name under --decamelize', async ({
      expect,
    }) => {
      for (const args of [
        'up -t pgMigrations -s myApp --create-schema --decamelize',
        'down 0 -t pgMigrations -s myApp --decamelize',
        'up -t pgMigrations -s myApp --decamelize',
      ]) {
        await expect(migrate(args)).resolves.toMatchObject({
          stdout: expect.stringContaining('Migrations complete!'),
        });
      }

      await expect(
        migrate('up -t pgMigrations -s myApp --decamelize')
      ).resolves.toMatchObject({
        stdout: expect.stringContaining('No migrations to run!'),
      });
      await expect(psqlSelect(pgContainer, TABLES)).resolves.toEqual([
        'myApp.pgMigrations',
        'myApp.users',
      ]);
    });

    it('gives a role without privileges on the migrations table a permissions error', async ({
      expect,
    }) => {
      await migrate('up 1');
      await psqlSelect(
        pgContainer,
        "CREATE ROLE limited LOGIN PASSWORD 'limited'; GRANT USAGE, CREATE ON SCHEMA public TO limited"
      );

      try {
        const url = new URL(pgContainer.getConnectionUri());
        url.username = 'limited';
        url.password = 'limited';

        const error = await migrate('up', url.toString()).catch(
          (error: unknown) => error
        );

        expect(error).toBeInstanceOf(Error);
        expect(String(error)).toContain(
          'permission denied for table pgmigrations'
        );
        expect(String(error)).not.toContain('already exists');
      } finally {
        await psqlSelect(
          pgContainer,
          'DROP OWNED BY limited; DROP ROLE limited'
        );
      }
    });
  }
);
