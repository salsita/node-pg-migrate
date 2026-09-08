import type { ClientBase } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { RunnerOption } from '../src';
import { runner } from '../src';

/**
 * Where the runner decides its bookkeeping table lives, and how that decision
 * relates to the `search_path` it forces on the session. See #894.
 *
 * A run only skips a migration when its name comes back from
 * `SELECT name FROM <migrationsTable>`. If that table resolves to a different
 * schema or spelling than the one the previous run wrote to, the query hits a
 * fresh, empty table, every migration looks pending, and the replay runs
 * against a database that already has those objects - which surfaces as
 * `relation "..." does not exist` rather than as a configuration error.
 *
 * The suite is in two halves:
 *
 * - `current behaviour` records the facts, so a fix has to acknowledge what it
 *   changes. These pass.
 * - `expected behaviour` states what should happen instead. These FAIL, and are
 *   meant to - they are the bug. Fixing #894 turns them green.
 */

interface MockOptions {
  /**
   * Names the bookkeeping table reports as already run.
   */
  runNames?: string[];

  /**
   * Whether the `information_schema` probe finds the bookkeeping table.
   */
  migrationsTableExists?: boolean;
}

function createMockClient(options: MockOptions = {}): {
  dbClient: ClientBase;
  queries: string[];
} {
  const { runNames = [], migrationsTableExists = false } = options;

  const queries: string[] = [];

  const dbClient = {
    query: vi.fn((query: string) => {
      queries.push(query);

      if (query.startsWith('SELECT pg_try_advisory_lock')) {
        return Promise.resolve({ rows: [{ lockObtained: true }] });
      }

      if (query.startsWith('SELECT pg_advisory_unlock')) {
        return Promise.resolve({ rows: [{ lockReleased: true }] });
      }

      if (
        query.startsWith('SELECT table_name FROM information_schema.tables')
      ) {
        return Promise.resolve({
          rows: migrationsTableExists
            ? [{ table_name: 'migrations table' }]
            : [],
        });
      }

      if (
        query.startsWith(
          'SELECT constraint_name FROM information_schema.table_constraints'
        )
      ) {
        return Promise.resolve({ rows: [{ constraint_name: 'pkey' }] });
      }

      if (query.startsWith('SELECT name FROM ')) {
        return Promise.resolve({ rows: runNames.map((name) => ({ name })) });
      }

      return Promise.resolve({ rows: [{}] });
    }),
  } as unknown as ClientBase;

  return { dbClient, queries };
}

function noop(): void {
  // intentionally empty
}

async function runUp(
  options: Partial<RunnerOption> & MockOptions = {}
): Promise<string[]> {
  const { runNames, migrationsTableExists, ...runnerOptions } = options;
  const { dbClient, queries } = createMockClient({
    runNames,
    migrationsTableExists,
  });

  await runner({
    dbClient,
    migrationsTable: 'pgmigrations',
    dir: 'test/integration/migrations-rerun',
    direction: 'up',
    // The queries are the subject under test, the progress log is just noise.
    logger: { debug: undefined, info: noop, warn: noop, error: noop },
    ...runnerOptions,
  });

  return queries;
}

function findQuery(queries: string[], prefix: string): string | undefined {
  return queries.find((query) => query.startsWith(prefix));
}

/**
 * The statements that address the bookkeeping table, in the order they run.
 */
const BOOKKEEPING_STATEMENT =
  /^(?:CREATE TABLE|INSERT INTO|DELETE FROM|SELECT name FROM|ALTER TABLE) "(?<schema>[^"]+)"\."(?<table>[^"]+)"/;

/**
 * The raw value the existence probe interpolates into `information_schema`.
 */
const PROBE_IDENTIFIERS =
  /table_schema = '(?<schema>[^']+)' AND table_name = '(?<table>[^']+)'/;

/**
 * Every distinct spelling of the bookkeeping table used across one run,
 * including the one the existence probe looks for.
 */
function migrationsTableNames(queries: string[]): string[] {
  const names = new Set<string>();

  for (const query of queries) {
    const statement = BOOKKEEPING_STATEMENT.exec(query);
    if (statement?.groups) {
      names.add(statement.groups.table);
    }

    const probe = PROBE_IDENTIFIERS.exec(query);
    if (probe?.groups) {
      names.add(probe.groups.table);
    }
  }

  return [...names].toSorted();
}

/**
 * Every distinct schema one run treats as "the schema", across `CREATE SCHEMA`,
 * `SET search_path` and the bookkeeping statements.
 */
function schemaNames(queries: string[]): string[] {
  const names = new Set<string>();

  for (const query of queries) {
    const created = /^CREATE SCHEMA IF NOT EXISTS "([^"]+)"/.exec(query);
    if (created) {
      names.add(created[1]);
    }

    const searchPath = /^SET search_path TO (.+)$/.exec(query);
    if (searchPath) {
      for (const [, schema] of searchPath[1].matchAll(/"([^"]+)"/g)) {
        names.add(schema);
      }
    }

    const statement = BOOKKEEPING_STATEMENT.exec(query);
    if (statement?.groups) {
      names.add(statement.groups.schema);
    }
  }

  return [...names].toSorted();
}

function migrationsTableSchema(queries: string[]): string | undefined {
  for (const query of queries) {
    const statement = BOOKKEEPING_STATEMENT.exec(query);
    if (statement?.groups) {
      return statement.groups.schema;
    }
  }

  return undefined;
}

describe('migrations table resolution', () => {
  describe('current behaviour', () => {
    it('should force the session search_path when a schema is configured', async () => {
      // `src/cli/config.ts` does `SCHEMA ??= ['public']`, so the CLI hands this
      // in on every single run, whether or not the user mentioned a schema.
      const queries = await runUp({ schema: ['public'] });

      expect(queries).toContain('SET search_path TO "public"');
    });

    it('should leave the session search_path alone when no schema is configured', async () => {
      const queries = await runUp();

      expect(findQuery(queries, 'SET search_path')).toBeUndefined();
    });

    it('should pin the migrations table to public when no schema is configured', async () => {
      const queries = await runUp();

      // `getMigrationTableSchema` falls back to `getSchemas(undefined)[0]`, so
      // the bookkeeping table is qualified with `public` even though the
      // migration DDL is left to resolve through the session search_path.
      expect(queries).toContain(
        'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id'
      );
    });

    it('should put the migrations table in the first configured schema', async () => {
      const queries = await runUp({ schema: ['app', 'public'] });

      expect(queries).toContain('SET search_path TO "app", "public"');
      expect(migrationsTableSchema(queries)).toBe('app');
    });

    it('should let migrationsSchema override the schema list', async () => {
      const queries = await runUp({
        schema: ['app'],
        migrationsSchema: 'meta',
      });

      expect(queries).toContain('SET search_path TO "app"');
      expect(migrationsTableSchema(queries)).toBe('meta');
    });

    it('should replay every migration when the bookkeeping table comes back empty', async () => {
      const queries = await runUp({
        migrationsTableExists: true,
        runNames: [],
      });

      // Correct for a genuinely new database. The problem is that a
      // misresolved table is indistinguishable from one: nothing checks
      // whether the objects already exist, or whether a populated
      // `pgmigrations` lives elsewhere in the database.
      expect(findQuery(queries, 'CREATE TABLE "users"')).toBeDefined();
      expect(findQuery(queries, 'ALTER TABLE "users"')).toBeDefined();
    });

    it('should skip migrations the bookkeeping table already records', async () => {
      const queries = await runUp({
        migrationsTableExists: true,
        runNames: ['001_create_users', '002_add_contract_id'],
      });

      expect(findQuery(queries, 'CREATE TABLE "users"')).toBeUndefined();
      expect(findQuery(queries, 'ALTER TABLE "users"')).toBeUndefined();
    });
  });

  describe('expected behaviour', () => {
    it('should address the migrations table by one name throughout a run', async () => {
      const queries = await runUp({
        migrationsTable: 'pgMigrations',
        decamelize: true,
      });

      // Three separate spellings today: the existence probe interpolates the
      // raw option value, `ensureMigrationsTable` and the read-back go
      // through `createSchemalize` (which decamelizes), and
      // `Migration._getMarkAsRun` quotes the raw value by hand. The run
      // creates one table and then writes to another.
      expect(migrationsTableNames(queries)).toStrictEqual(['pg_migrations']);
    });

    it('should use one schema for both the search_path and the migrations table', async () => {
      const queries = await runUp({
        schema: ['myApp'],
        createSchema: true,
        decamelize: true,
      });

      // `runner` writes the schema verbatim into `CREATE SCHEMA` and
      // `SET search_path`, while `getMigrationTableSchema` decamelizes it.
      // The run creates "myApp" and then targets "my_app".
      expect(schemaNames(queries)).toStrictEqual(['myApp']);
    });

    it('should keep the migrations table in one place when the schema list is reordered', async () => {
      const forwards = await runUp({ schema: ['app', 'public'] });
      const backwards = await runUp({ schema: ['public', 'app'] });

      // `['app', 'public']` and `['public', 'app']` describe the same set of
      // schemas, but `getMigrationTableSchema` takes the first entry, so the
      // bookkeeping table moves and the next run replays everything into the
      // other schema.
      expect(migrationsTableSchema(backwards)).toBe(
        migrationsTableSchema(forwards)
      );
    });

    it('should detect the migrations table regardless of the role privileges', async () => {
      const queries = await runUp();

      const probe = findQuery(queries, 'SELECT table_name FROM');

      // `information_schema.tables` only lists tables the connected role
      // holds a privilege on, so a role with no grant on an existing
      // `pgmigrations` is told the table is missing and the runner tries to
      // create it. `pg_catalog` / `to_regclass` answer regardless of grants.
      expect(probe).not.toContain('information_schema');
    });
  });
});
