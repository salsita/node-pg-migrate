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
 * The suite is in two halves:
 *
 * - `current behaviour` records the facts, including the ones that already
 *   work, so a fix has to acknowledge what it changes. These pass.
 * - `expected behaviour` states what should happen instead. These FAIL, and are
 *   meant to - they are the bug. Fixing #894 turns them green.
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

    describe('current behaviour', () => {
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

      it('should replay the reported scenario and fail on the missing relation', async () => {
        await seedSchemaOnSearchPath();

        const result = await runCli(`up -m ${ALTER_ONLY_MIGRATIONS_DIR}`);

        // The output from the issue, reproduced: the recorded migration is
        // listed as pending, and the replayed `ALTER TABLE "users"` resolves
        // against `public`, where no such table exists.
        expect(result.code).not.toBe(0);
        expect(result.stdout).toContain('> - 001_add_contract_id');
        expect(result.stderr).toContain('relation "users" does not exist');

        // The original bookkeeping is untouched in `app`, while a second,
        // rolled-back table was created in `public`.
        expect(await recordedMigrations('app')).toStrictEqual([
          '001_add_contract_id',
        ]);
        expect(await tablesIn('public')).toContain('pgmigrations');
      });

      it('should migrate a database named after the role when PGDATABASE is unset', async () => {
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

          // `pg` defaults `database` to the user name, so the CLI's "incomplete
          // connection parameters" guard - which only ever really checks
          // `PGHOST` - passes and the run migrates a database the user never
          // named. Nothing in the output says which one was touched, so this is
          // the other route into the symptoms from #894.
          expect(result.code).toBe(0);
          expect(result.stdout).toContain('> Migrating files:');
          expect(result.stdout).not.toContain(pgContainer.getDatabase());

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
      it('should honour a role-level search_path and skip the recorded migration', async () => {
        await seedSchemaOnSearchPath();

        const result = await runCli(`up -m ${ALTER_ONLY_MIGRATIONS_DIR}`);

        // The CLI's fabricated `schema: ['public']` default makes the runner
        // issue `SET search_path TO "public"`, discarding the role's own
        // search_path, so it never sees `app.pgmigrations`.
        expect(result.stdout).toContain('No migrations to run!');
        expect(result.code).toBe(0);
      });

      it('should honour a search_path supplied through the connection string', async () => {
        await client.query('CREATE SCHEMA app');

        const connectionString = `${pgContainer.getConnectionUri()}?options=-c%20search_path%3Dapp`;
        const result = await runCli(`up -m ${MIGRATIONS_DIR}`, {
          DATABASE_URL: connectionString,
        });

        expect(result.code).toBe(0);
        // The connection explicitly asked for `search_path=app`. The forced
        // `SET search_path TO "public"` overrides it and everything lands in
        // `public` instead.
        expect(await tablesIn('app')).toStrictEqual(['pgmigrations', 'users']);
      });

      it('should not silently replay when the schema flag is dropped between runs', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app --create-schema`
        );
        expect(first.code).toBe(0);
        expect(await recordedMigrations('app')).toHaveLength(2);

        const second = await runCli(`up -m ${MIGRATIONS_DIR}`);

        // Skipping or refusing with a diagnostic are both defensible. Copying
        // the whole schema into `public` without a word is not.
        expect(second.stdout).not.toContain('> Migrating files:');
      });

      it('should not replay when the schema list is only reordered', async () => {
        const first = await runCli(
          `up -m ${MIGRATIONS_DIR} -s app public --create-schema`
        );
        expect(first.code).toBe(0);
        expect(await recordedMigrations('app')).toHaveLength(2);

        // Same two schemas, same search_path contents, different order.
        const second = await runCli(`up -m ${MIGRATIONS_DIR} -s public app`);

        // `getMigrationTableSchema` takes the first entry, so the migrations
        // table moves and everything is replayed into the other schema.
        expect(second.stdout).toContain('No migrations to run!');
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
        expect(second.stdout).toContain('No migrations to run!');
      });

      it('should create the schema and the migrations table under one name when decamelize is set', async () => {
        const result = await runCli(
          `up -m ${MIGRATIONS_DIR} -s myApp --create-schema --decamelize`
        );

        // `CREATE SCHEMA` / `SET search_path` use the raw schema name while
        // the migrations table is resolved through `createSchemalize`, which
        // decamelizes it. The run creates "myApp" and then targets "my_app".
        expect(result.code).toBe(0);
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
        } finally {
          // The role holds grants, so it has to be stripped before it can go.
          await client.query('DROP OWNED BY limited_role');
          await client.query('DROP ROLE limited_role');
        }
      });
    });
  }
);
