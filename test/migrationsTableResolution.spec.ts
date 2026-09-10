import type { ClientBase, QueryConfig } from 'pg';
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
 * - `contract` pins behaviour the fix must keep, including the documented
 *   `public` default. These pass today and must keep passing.
 * - `expected behaviour` states what should happen instead. These FAIL, and are
 *   meant to - they are the bug. Fixing #894 turns them green. They assert
 *   invariants rather than particular SQL, so any correct fix satisfies them.
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

interface RecordedQuery {
  text: string;
  values: unknown[];
}

function createMockClient(options: MockOptions = {}): {
  dbClient: ClientBase;
  queries: RecordedQuery[];
} {
  const { runNames = [], migrationsTableExists = false } = options;

  const queries: RecordedQuery[] = [];

  const dbClient = {
    query: vi.fn((config: string | QueryConfig, values?: unknown[]) => {
      const query = typeof config === 'string' ? config : config.text;
      queries.push({
        text: query,
        values:
          values ?? (typeof config === 'string' ? [] : (config.values ?? [])),
      });

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
): Promise<RecordedQuery[]> {
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

function findQuery(
  queries: RecordedQuery[],
  prefix: string
): string | undefined {
  return queries.find(({ text }) => text.startsWith(prefix))?.text;
}

/**
 * The schema of the first statement that addresses the migrations table.
 */
function migrationsTableSchema(queries: RecordedQuery[]): string | undefined {
  for (const { text } of queries) {
    const statement =
      /^(?:CREATE TABLE|INSERT INTO|DELETE FROM|SELECT name FROM|ALTER TABLE) "([^"]+)"\."[^"]+"/.exec(
        text
      );
    if (statement) {
      return statement[1];
    }
  }

  return undefined;
}

/**
 * Which of the given spellings of one identifier a run used anywhere, in the
 * SQL text or in bound parameters. Independent of how the SQL is shaped, so it
 * holds for any implementation.
 */
function spellingsUsed(
  queries: RecordedQuery[],
  spellings: ReadonlyArray<string>
): string[] {
  const haystack = queries
    .map(({ text, values }) => `${text}\n${JSON.stringify(values)}`)
    .join('\n');

  return spellings.filter((spelling) =>
    new RegExp(`(?<![\\w$])${spelling}(?![\\w$])`).test(haystack)
  );
}

describe('migrations table resolution', () => {
  describe('contract', () => {
    it('should force the session search_path when a schema is configured', async () => {
      // `src/cli/config.ts` does `SCHEMA ??= ['public']`, so the CLI hands this
      // in on every single run, whether or not the user mentioned a schema.
      const queries = await runUp({ schema: ['public'] });

      expect(findQuery(queries, 'SET search_path')).toBe(
        'SET search_path TO "public"'
      );
    });

    it('should leave the session search_path alone when no schema is configured', async () => {
      const queries = await runUp();

      expect(findQuery(queries, 'SET search_path')).toBeUndefined();
    });

    it('should keep the migrations table in public when no schema is configured', async () => {
      const queries = await runUp();

      // Documented: `schema` defaults to `public`, and `migrationsSchema` to
      // the same value as `schema`.
      expect(migrationsTableSchema(queries)).toBe('public');
    });

    it('should put the migrations table in the first configured schema', async () => {
      const queries = await runUp({ schema: ['app', 'public'] });

      expect(findQuery(queries, 'SET search_path')).toBe(
        'SET search_path TO "app", "public"'
      );
      expect(migrationsTableSchema(queries)).toBe('app');
    });

    it('should let migrationsSchema override the schema list', async () => {
      const queries = await runUp({
        schema: ['app'],
        migrationsSchema: 'meta',
      });

      expect(findQuery(queries, 'SET search_path')).toBe(
        'SET search_path TO "app"'
      );
      expect(migrationsTableSchema(queries)).toBe('meta');
    });

    it('should run every migration against a new database', async () => {
      const queries = await runUp();

      expect(findQuery(queries, 'CREATE TABLE "users"')).toBeDefined();
      expect(findQuery(queries, 'ALTER TABLE "users"')).toBeDefined();
    });

    it('should skip migrations the migrations table already records', async () => {
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

      // Two spellings today: the existence probe interpolates the raw option
      // value and `Migration._getMarkAsRun` quotes it by hand, while
      // `ensureMigrationsTable` and the read-back go through
      // `createSchemalize`, which decamelizes it. The run creates one table and
      // then writes to another. Either spelling is fine, as long as it is one.
      expect(
        spellingsUsed(queries, ['pgMigrations', 'pg_migrations'])
      ).toHaveLength(1);
    });

    it('should use one schema name for the search_path and the migrations table', async () => {
      const queries = await runUp({
        schema: ['myApp'],
        createSchema: true,
        decamelize: true,
      });

      // `runner` writes the schema verbatim into `CREATE SCHEMA` and
      // `SET search_path`, while `getMigrationTableSchema` feeds it through
      // `createSchemalize`, which decamelizes it. The run creates "myApp" and
      // then targets "my_app".
      expect(spellingsUsed(queries, ['myApp', 'my_app'])).toHaveLength(1);
    });

    it('should not look the migrations table up through information_schema', async () => {
      const queries = await runUp();

      // `information_schema` only lists objects the connected role holds a
      // privilege on, so a role without a grant on an existing migrations table
      // is told it is missing, and the runner tries to create it again.
      // `pg_catalog` answers regardless of grants.
      expect(
        queries.filter(({ text }) => text.includes('information_schema'))
      ).toStrictEqual([]);
    });
  });
});
