import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import type { BaselineErrorCode, BaselineOptions } from '../../../src';
import { baseline } from '../../../src';
import {
  BaselineError,
  generateBaselineFromCatalogs,
} from '../../../src/baseline/catalogs';
import type { SchemaFixture } from '../utils';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../utils';
import {
  migrateUp,
  recordingLogger,
  rejectionOf,
  workDir,
  writeSqlMigration,
} from './helpers';

// `generateBaselineFromCatalogs()`, the entry
// `node-pg-migrate/baseline/catalogs`, must generate through any client with a
// `query()` exactly the migration that `baseline()` writes with `format` `'ts'`
// or `'js'` for the same database and options, return what `baseline()`
// returns about it (without the file path), and refuse what `baseline()`
// refuses, with the same code. It writes no file and logs nothing, and it
// leaves the caller's client open, outside any transaction.

/**
 * The options of `baseline()` that decide what a TypeScript or JavaScript
 * baseline says. `generateBaselineFromCatalogs()` takes them with the same
 * names.
 */
type OutputOptions = Pick<
  BaselineOptions,
  | 'schema'
  | 'migrationsTable'
  | 'migrationsSchema'
  | 'includeSchemas'
  | 'excludeSchemas'
  | 'strict'
  | 'decamelize'
> & {
  /**
   * The language of the migration.
   */
  readonly format: 'ts' | 'js';
};

/**
 * A database and options that `baseline()` writes a migration for.
 */
interface SameMigrationCase {
  readonly title: string;
  readonly fixture: SchemaFixture;
  readonly options: OutputOptions;
}

/**
 * Every schema fixture in both languages, then the options that change what
 * the migration says or what it is made from.
 */
const SAME_MIGRATION_CASES: ReadonlyArray<SameMigrationCase> = [
  ...SCHEMA_FIXTURES.flatMap((fixture) =>
    (['ts', 'js'] as const).map((format) => ({
      title: `${fixture} as ${format}`,
      fixture,
      options: { format },
    }))
  ),
  {
    title: 'kitchen-sink with includeSchemas',
    fixture: 'kitchen-sink',
    options: { format: 'ts', includeSchemas: ['kitchen', 'Sink Área'] },
  },
  {
    title: 'kitchen-sink with excludeSchemas',
    fixture: 'kitchen-sink',
    options: { format: 'js', excludeSchemas: ['kitchen_audit'] },
  },
  {
    title: 'kitchen-sink with its own schemas and migrations table',
    fixture: 'kitchen-sink',
    options: {
      format: 'ts',
      schema: ['kitchen', 'public'],
      migrationsTable: 'kitchen_migrations',
      migrationsSchema: 'kitchen_audit',
    },
  },
  {
    title: 'chinook, strict and with decamelize',
    fixture: 'chinook',
    options: { format: 'ts', strict: true, decamelize: true },
  },
];

/**
 * A database that `baseline()` refuses, and why.
 */
interface RefusalCase {
  readonly title: string;

  /**
   * The code of the `BaselineError` that `baseline()` throws.
   */
  readonly code: BaselineErrorCode;

  /**
   * The schema fixture of the database, or the SQL that makes it.
   */
  readonly database:
    | { readonly fixture: SchemaFixture }
    | { readonly sql: string }
    | { readonly history: { readonly schema?: string } };

  readonly options: OutputOptions;
}

/**
 * What `baseline()` refuses: the refusals of the server and the migration
 * history, then those of the options and of the schema.
 */
const REFUSAL_CASES: ReadonlyArray<RefusalCase> = [
  {
    title: 'a migrations table that records migrations',
    code: 'HISTORY_EXISTS',
    database: { history: {} },
    options: { format: 'ts' },
  },
  {
    title: 'a migrations table in the first schema that records migrations',
    code: 'HISTORY_EXISTS',
    database: { history: { schema: 'app' } },
    options: { format: 'js', schema: ['app', 'public'] },
  },
  {
    title: 'a view with the name of the migrations table',
    code: 'INVALID_MIGRATIONS_TABLE',
    database: {
      sql: 'CREATE VIEW public.pgmigrations AS SELECT 1 AS id, pg_catalog.now() AS run_on;',
    },
    options: { format: 'ts' },
  },
  {
    title: 'includeSchemas that name no schema',
    code: 'INVALID_OPTIONS',
    database: { fixture: 'kitchen-sink' },
    options: { format: 'ts', includeSchemas: ['kitchen', 'Kitchen', 'nosuch'] },
  },
  {
    title: 'identifiers that decamelize would rename',
    code: 'INVALID_OPTIONS',
    database: { fixture: 'kitchen-sink' },
    options: { format: 'ts', decamelize: true },
  },
  {
    title: 'objects that need raw SQL, with strict',
    code: 'UNSUPPORTED_OBJECTS',
    database: { fixture: 'pagila' },
    options: { format: 'ts', strict: true },
  },
];

/**
 * A migration name for the refusals, where `baseline()` picks none.
 */
const MIGRATION_NAME = '1700000000000_baseline';

/**
 * Connects a `pg` client that is closed when the current test finishes.
 *
 * @param url The database.
 *
 * @returns The connected client.
 */
async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  onTestFinished(async () => {
    await client.end();
  });

  return client;
}

/**
 * Records what the current test writes to the console from now on, instead
 * of printing it.
 *
 * @returns A function that returns the calls so far, one `<method>:
 * <arguments>` each.
 */
function recordConsole(): () => string[] {
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const spies = methods.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {})
  );
  onTestFinished(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  });

  return () =>
    spies.flatMap((spy, index) =>
      spy.mock.calls.map(
        (args) => `${methods[index]}: ${args.map(String).join(' ')}`
      )
    );
}

/**
 * Checks that a client is still open and outside any transaction: the first
 * statement of a transaction starts with it, so a statement runs in a
 * transaction of its own only when both started at the same time.
 *
 * @param client The client.
 */
async function expectOutsideTransaction(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{ readonly own: boolean }>(
    'SELECT pg_catalog.statement_timestamp() OPERATOR(pg_catalog.=) pg_catalog.transaction_timestamp() AS own'
  );

  expect(rows).toEqual([{ own: true }]);
}

describe.each(PG_VERSIONS)(
  'generateBaselineFromCatalogs() (PG %s)',
  // Loading Pagila and reading it twice takes several round trips.
  { timeout: INTEGRATION_TIMEOUT * 2 },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let databaseCount = 0;
    const fixtureDatabases = new Map<SchemaFixture, Promise<string>>();

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Creates a database with a name no other test uses.
     *
     * @param prefix The start of the name.
     *
     * @returns The name of the new database.
     */
    async function newDatabase(prefix: string): Promise<string> {
      databaseCount += 1;
      const name = `${prefix}_${databaseCount}`;
      await createDatabase(container, name);

      return name;
    }

    /**
     * The database with a schema fixture, loaded once: baselines only read
     * it.
     *
     * @param fixture The fixture.
     *
     * @returns The name of the database.
     */
    function fixtureDatabase(fixture: SchemaFixture): Promise<string> {
      let database = fixtureDatabases.get(fixture);
      if (database === undefined) {
        database = (async () => {
          const name = await newDatabase(fixture.replaceAll('-', '_'));
          await loadFixture(container, name, fixture);

          return name;
        })();
        fixtureDatabases.set(fixture, database);
      }

      return database;
    }

    /**
     * Makes the database of a refusal.
     *
     * @param database What it has.
     *
     * @returns The name of the database.
     */
    async function refusedDatabase(
      database: RefusalCase['database']
    ): Promise<string> {
      if ('fixture' in database) {
        return fixtureDatabase(database.fixture);
      }

      const name = await newDatabase('refused');
      if ('sql' in database) {
        await loadSql(container, name, database.sql);

        return name;
      }

      const { schema } = database.history;
      if (schema !== undefined) {
        await loadSql(container, name, `CREATE SCHEMA ${schema};`);
      }

      const history = await workDir();
      await writeSqlMigration(history, '1_first', [
        'CREATE TABLE first_table (id integer PRIMARY KEY);',
      ]);
      await migrateUp(databaseUrl(container, name), history, { schema });

      return name;
    }

    it.each(SAME_MIGRATION_CASES)(
      'generates the migration baseline() writes: $title',
      async ({ fixture, options }) => {
        const url = databaseUrl(container, await fixtureDatabase(fixture));
        const dir = join(await workDir(), 'migrations');
        const { path, ...written } = await baseline({
          ...options,
          databaseUrl: url,
          dir,
          logger: recordingLogger(),
        });
        const content = await readFile(path, 'utf8');
        const client = await connect(url);
        const logged = recordConsole();

        const generated = await generateBaselineFromCatalogs(client, {
          ...options,
          migrationName: written.migrationName,
          dir,
        });

        expect(generated.content).toBe(content);
        expect(generated).toMatchObject({ ...written, content });
        expect(logged()).toEqual([]);
        await expectOutsideTransaction(client);
      }
    );

    it.each(REFUSAL_CASES)(
      'refuses what baseline() refuses: $title ($code)',
      async ({ code, database, options }) => {
        const url = databaseUrl(container, await refusedDatabase(database));
        const refusal = await rejectionOf(
          baseline({
            ...options,
            databaseUrl: url,
            dir: join(await workDir(), 'migrations'),
            logger: recordingLogger(),
          })
        );
        expect(refusal).toMatchObject({ code });
        const client = await connect(url);
        const logged = recordConsole();

        const error = await rejectionOf(
          generateBaselineFromCatalogs(client, {
            ...options,
            migrationName: MIGRATION_NAME,
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code });
        expect(logged()).toEqual([]);
        await expectOutsideTransaction(client);
      }
    );
  }
);
