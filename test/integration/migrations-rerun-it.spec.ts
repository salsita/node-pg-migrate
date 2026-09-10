import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  cleanupDatabase,
  exec,
  INTEGRATION_TIMEOUT,
  PG_VERSIONS,
  setupPostgresDatabase,
} from './utils';

/**
 * End-to-end reproductions of #894: node-pg-migrate replays migrations the
 * database already records, then fails with `relation "..." does not exist`.
 *
 * One root cause behind all of them. The runner decides where its migrations
 * table lives from configuration alone and forces that same schema onto the
 * session `search_path`, without checking that either matches where the
 * previous run wrote. Any drift - a role-level `search_path`, a reordered
 * `--schema` list, a dropped flag, a decamelized name - reads an empty table,
 * concludes the database is new, and replays everything.
 *
 * `--schema` defaulting to `public` is documented behaviour and is not the bug:
 * the bug is that a run which cannot find the history where it expects it
 * treats the database as new, instead of noticing the history elsewhere.
 *
 * The suite is in two halves:
 *
 * - `contract` pins behaviour the fix must keep: the documented defaults, and
 *   the setups that legitimately run the same migrations more than once. These
 *   pass today and must keep passing.
 * - `expected behaviour` states what should happen instead of the replay. These
 *   FAIL, and are meant to - they are the bug. Fixing #894 turns them green.
 *   They accept either outcome a fix may reasonably choose, carrying on from
 *   the existing history or refusing and saying where it is, and reject only
 *   the silent replay.
 */

const MIGRATIONS_DIR = 'test/integration/migrations-rerun';
const ALTER_ONLY_MIGRATIONS_DIR =
  'test/integration/migrations-rerun-alter-only';

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

describe.each(PG_VERSIONS)(
  'replaying already-run migrations (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let pgContainer: StartedPostgreSqlContainer;
    let client: Client;

    beforeAll(async () => {
      pgContainer = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`,
        `test_migrations_rerun_pg_${postgresVersion}`
      );

      client = new Client({ connectionString: pgContainer.getConnectionUri() });
      await client.connect();
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      if (client) {
        await client.end();
      }

      if (pgContainer) {
        await pgContainer.stop();
      }
    });

    beforeEach(async () => {
      // Role-level settings survive `cleanupDatabase`, and one test below
      // changes them, so reset before every test rather than after.
      await client.query(
        `ALTER ROLE "${pgContainer.getUsername()}" RESET search_path`
      );
    });

    afterEach(async () => {
      await cleanupDatabase(pgContainer);
    });

    /**
     * Runs the CLI without throwing, so that failing runs can be asserted on.
     */
    async function runCli(
      args: string,
      env: NodeJS.ProcessEnv = {}
    ): Promise<CliResult> {
      const command = `node bin/node-pg-migrate.js ${args}`;

      try {
        const { stdout, stderr } = await exec(command, {
          env: {
            ...process.env,
            DATABASE_URL: pgContainer.getConnectionUri(),
            ...env,
          },
        });

        return { code: 0, stdout, stderr };
      } catch (error) {
        const failure = error as {
          code?: number;
          stdout?: string;
          stderr?: string;
        };

        return {
          code: failure.code ?? 1,
          stdout: failure.stdout ?? '',
          stderr: failure.stderr ?? '',
        };
      }
    }

    async function tablesIn(schema: string): Promise<string[]> {
      const { rows } = await client.query<{ tablename: string }>(
        'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
        [schema]
      );

      return rows.map((row) => row.tablename);
    }

    async function recordedMigrations(
      schema: string,
      table = 'pgmigrations'
    ): Promise<string[]> {
      const { rows } = await client.query<{ name: string }>(
        `SELECT name FROM "${schema}"."${table}" ORDER BY run_on, id`
      );

      return rows.map((row) => row.name);
    }

    /**
     * Rejects the silent replay while accepting both reasonable fixes: carrying
     * on from the history already recorded in `schema`, or refusing to run and
     * naming where that history is.
     */
    function expectHistoryRespected(result: CliResult, schema: string): void {
      expect(result.stdout).not.toContain('> Migrating files:');
      expect(`${result.stdout}\n${result.stderr}`).toMatch(
        new RegExp(`No migrations to run!|"?${schema}"?\\."?pgmigrations"?`)
      );
    }

    /**
     * Sets up the reported scenario: a database organised around a non-public
     * schema that the role's own `search_path` points at, with the migration
     * already recorded there. psql and pgAdmin resolve `users` and
     * `pgmigrations` without qualifying anything.
     */
    async function seedSchemaOnSearchPath(): Promise<void> {
      await client.query('CREATE SCHEMA app');
      await client.query('CREATE TABLE app.users (id serial PRIMARY KEY)');
      await client.query(
        'CREATE TABLE app.pgmigrations (id serial PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
      await client.query(
        "INSERT INTO app.pgmigrations (name, run_on) VALUES ('001_add_contract_id', NOW())"
      );
      await client.query(
        `ALTER ROLE "${pgContainer.getUsername()}" SET search_path TO app, public`
      );
    }

    describe('contract', () => {
      it('should not replay migrations on an unchanged setup', async () => {
        const first = await runCli(`up -m ${MIGRATIONS_DIR}`);
        expect(first.code).toBe(0);
        expect(first.stdout).toContain('> Migrating files:');

        const second = await runCli(`up -m ${MIGRATIONS_DIR}`);
        expect(second.code).toBe(0);
        expect(second.stdout).toContain('No migrations to run!');
        expect(await recordedMigrations('public')).toStrictEqual([
          '001_create_users',
          '002_add_contract_id',
        ]);
      });

      it('should not replay migrations when migrationsSchema pins the table', async () => {
        // Pinning `--migrations-schema` decouples the migrations table from the
        // schema list, so reordering it no longer loses the history.
        const args = `-m ${MIGRATIONS_DIR} --migrations-schema meta --create-migrations-schema --create-schema`;

        const first = await runCli(`up ${args} -s app public`);
        expect(first.code).toBe(0);
        expect(await recordedMigrations('meta')).toHaveLength(2);

        const second = await runCli(`up ${args} -s public app`);
        expect(second.code).toBe(0);
        expect(second.stdout).toContain('No migrations to run!');
      });

      it('should keep a separate history for each explicitly selected schema', async () => {
        const tenantA = await runCli(
          `up -m ${MIGRATIONS_DIR} -s tenant_a --create-schema`
        );
        expect(tenantA.code).toBe(0);

        // Running the same migrations against a second schema is how
        // schema-per-tenant setups work. A populated migrations table in
        // another schema is not drift when the schema is named explicitly.
        const tenantB = await runCli(
          `up -m ${MIGRATIONS_DIR} -s tenant_b --create-schema`
        );
        expect(tenantB.code).toBe(0);
        expect(tenantB.stdout).toContain('> Migrating files:');
        expect(await recordedMigrations('tenant_a')).toHaveLength(2);
        expect(await recordedMigrations('tenant_b')).toHaveLength(2);
      });

      it('should apply the documented public default over a connection-level search_path', async () => {
        await client.query('CREATE SCHEMA app');

        const connectionString = `${pgContainer.getConnectionUri()}?options=-c%20search_path%3Dapp`;
        const result = await runCli(`up -m ${MIGRATIONS_DIR}`, {
          DATABASE_URL: connectionString,
        });

        // `--schema` defaults to `public` and is what sets the search_path
        // (docs/src/cli.md), so on a fresh database it wins over the
        // connection's own. Changing that would move where every existing
        // user's objects are created.
        expect(result.code).toBe(0);
        expect(await tablesIn('public')).toStrictEqual([
          'pgmigrations',
          'users',
        ]);
        expect(await tablesIn('app')).toStrictEqual([]);
      });

      it('should fall back to a database named after the role when PGDATABASE is unset', async () => {
        const role = pgContainer.getUsername();

        // Built field by field on purpose: `pg` lets a `connectionString` win
        // over an explicit `database`, which would silently point these clients
        // back at the container's default database.
        const connectTo = (database: string): Client =>
          new Client({
            host: pgContainer.getHost(),
            port: pgContainer.getPort(),
            user: role,
            password: pgContainer.getPassword(),
            database,
          });

        const adminClient = connectTo(pgContainer.getDatabase());
        await adminClient.connect();

        try {
          await adminClient.query(`DROP DATABASE IF EXISTS "${role}"`);
          await adminClient.query(`CREATE DATABASE "${role}"`);

          const result = await runCli(`up -m ${MIGRATIONS_DIR}`, {
            DATABASE_URL: '',
            PGHOST: pgContainer.getHost(),
            PGPORT: String(pgContainer.getPort()),
            PGUSER: role,
            PGPASSWORD: pgContainer.getPassword(),
            PGDATABASE: '',
          });

          // libpq semantics: the database defaults to the user name. Another
          // route into the symptoms from #894, but a documented default, so it
          // is recorded here rather than treated as the bug.
          expect(result.code).toBe(0);
          expect(result.stdout).toContain('> Migrating files:');

          // The database the user meant is untouched...
          expect(await tablesIn('public')).toStrictEqual([]);

          // ...while the role-named one was migrated.
          const strayClient = connectTo(role);
          await strayClient.connect();

          try {
            const { rows } = await strayClient.query<{ tablename: string }>(
              "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
            );
            expect(rows.map((row) => row.tablename)).toStrictEqual([
              'pgmigrations',
              'users',
            ]);
          } finally {
            await strayClient.end();
          }
        } finally {
          await adminClient.query(`DROP DATABASE IF EXISTS "${role}"`);
          await adminClient.end();
        }
      });
    });

    describe('expected behaviour', () => {
      it('should not replay the recorded migration in the reported scenario', async () => {
        await seedSchemaOnSearchPath();

        const result = await runCli(`up -m ${ALTER_ONLY_MIGRATIONS_DIR}`);

        // Today this reproduces the issue byte for byte: the recorded migration
        // is listed as pending, and the replayed `ALTER TABLE "users"`
        // resolves against `public`, where no such table exists.
        expect(result.stderr).not.toContain('relation "users" does not exist');
        expectHistoryRespected(result, 'app');

        // Refusing must not leave anything behind: today an empty migrations
        // table is created in `public` before the replay fails.
        expect(await tablesIn('public')).toStrictEqual([]);
        expect(await recordedMigrations('app')).toStrictEqual([
          '001_add_contract_id',
        ]);
      });

      it('should not silently replay when the schema flag is dropped between runs', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app --create-schema`
        );
        expect(first.code).toBe(0);
        expect(await recordedMigrations('app')).toHaveLength(2);

        const second = await runCli(`up -m ${MIGRATIONS_DIR}`);

        // Today the whole schema is copied into `public` without a word.
        expectHistoryRespected(second, 'app');
        expect(await tablesIn('public')).toStrictEqual([]);
      });

      it('should not replay when the schema list is only reordered', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app public --create-schema`
        );
        expect(first.code).toBe(0);
        expect(await recordedMigrations('app')).toHaveLength(2);

        // Same two schemas, same search_path contents, different order.
        const second = await runCli(`up -m ${MIGRATIONS_DIR} -s public app`);

        // `getMigrationTableSchema` takes the first entry, so today the
        // migrations table moves and everything is replayed into `public`.
        expectHistoryRespected(second, 'app');
        expect(await tablesIn('public')).toStrictEqual([]);
      });

      it('should not report an empty history on down when the schema list is reordered', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app public --create-schema`
        );
        expect(first.code).toBe(0);

        const result = await runCli(`down -m ${MIGRATIONS_DIR} -s public app`);

        // Today `down` creates a second, empty migrations table in `public`,
        // then reports there is nothing to revert while `app` holds two
        // recorded migrations.
        expect(result.stdout).not.toContain('No migrations to run!');
        expect(await tablesIn('public')).not.toContain('pgmigrations');
      });

      it('should not fake-record migrations into a new table when the history is elsewhere', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app --create-schema`
        );
        expect(first.code).toBe(0);

        const result = await runCli(`up -m ${MIGRATIONS_DIR} --fake`);

        // Today `--fake` creates `public.pgmigrations` and marks every
        // migration as run there, recording a history for objects that do not
        // exist in `public`.
        expectHistoryRespected(result, 'app');
        expect(await tablesIn('public')).toStrictEqual([]);
      });

      it('should record migrations under the table it created when decamelize is set', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -t pgMigrations --decamelize`
        );

        // `ensureMigrationsTable` creates `"public"."pg_migrations"` while
        // `Migration._getMarkAsRun` inserts into `"public"."pgMigrations"`,
        // so the first run cannot record anything - and the raw-name
        // existence probe then retries `CREATE TABLE` on every later run.
        expect(first.code).toBe(0);

        const second = await runCli(
          `up -m ${MIGRATIONS_DIR} -t pgMigrations --decamelize`
        );
        expect(second.code).toBe(0);
        expect(second.stdout).toContain('No migrations to run!');
      });

      it('should create the schema and the migrations table under one name when decamelize is set', async () => {
        const args = `-m ${MIGRATIONS_DIR} -s myApp --create-schema --decamelize`;

        // `CREATE SCHEMA` / `SET search_path` use the raw schema name while
        // the migrations table is resolved through `createSchemalize`, which
        // decamelizes it. The run creates "myApp" and then targets "my_app".
        const first = await runCli(`up ${args}`);
        expect(first.code).toBe(0);

        const second = await runCli(`up ${args}`);
        expect(second.code).toBe(0);
        expect(second.stdout).toContain('No migrations to run!');
      });

      it('should report a permissions problem when the role cannot see the migrations table', async () => {
        const first = await runCli(`up -m ${MIGRATIONS_DIR}`);
        expect(first.code).toBe(0);

        await client.query(
          "CREATE ROLE limited_role LOGIN PASSWORD 'limited_role'"
        );

        try {
          await client.query(
            'GRANT USAGE, CREATE ON SCHEMA public TO limited_role'
          );

          const uri = new URL(pgContainer.getConnectionUri());
          uri.username = 'limited_role';
          uri.password = 'limited_role';

          const result = await runCli(`up -m ${MIGRATIONS_DIR}`, {
            DATABASE_URL: uri.toString(),
          });

          // `information_schema.tables` only lists tables the role holds a
          // privilege on, so the probe reports the table as missing and the
          // runner tries to create it. The user gets a create-table conflict
          // instead of being told about the missing grant.
          expect(result.stderr).not.toContain('already exists');
          expect(result.stderr).toMatch(/permission denied/i);
        } finally {
          // The role holds grants, so it has to be stripped before it can go.
          await client.query('DROP OWNED BY limited_role');
          await client.query('DROP ROLE limited_role');
        }
      });
    });
  }
);
