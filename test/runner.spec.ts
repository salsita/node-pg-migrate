import type { ClientBase } from 'pg';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { runner } from '../src';
import type { LogFn } from '../src/logger';
import type { RunMigration } from '../src/migration';
import type { RunnerOptionConfig } from '../src/runner';

// The catalog lookups the runner makes. Schema and table names are passed as parameters, so
// the text is the same wherever the migrations table lives.
const MIGRATIONS_TABLE_EXISTS =
  "SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND c.relkind IN ('r', 'p', 'v', 'f') AND n.nspname = $2";

const MIGRATIONS_TABLE_PRIMARY_KEY =
  "SELECT 1 FROM pg_catalog.pg_constraint WHERE contype = 'p' AND conrelid = (SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND c.relkind IN ('r', 'p', 'v', 'f') AND n.nspname = $2)";

const OTHER_MIGRATIONS_TABLES =
  "SELECT n.nspname AS \"schema\", has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT') AS \"readable\" FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND c.relkind IN ('r', 'p') AND n.nspname <> $2 AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname NOT IN ('information_schema', 'crdb_internal') AND (SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid = c.oid AND a.attname = ANY($3::text[]) AND NOT a.attisdropped) = 3 ORDER BY n.nspname";

/**
 * The same lookup, narrowed to the rest of a chosen schema list.
 */
const OTHER_MIGRATIONS_TABLES_IN_LIST = OTHER_MIGRATIONS_TABLES.replace(
  ' ORDER BY',
  ' AND n.nspname = ANY($4::text[]) ORDER BY'
);

describe('runner', () => {
  it('should return a function', () => {
    expect(runner).toBeTypeOf('function');
  });

  it('should throw an error when not options passed', async () => {
    await expect(
      // @ts-expect-error: runner needs options
      runner()
    ).rejects.toThrow(
      new TypeError(
        "Cannot destructure property 'log' of 'options' as it is undefined."
      )
    );
  });

  it('should throw an error when no databaseUrl or dbClient passed', async () => {
    await expect(
      // @ts-expect-error: runner needs options
      runner({ log: console.log })
    ).rejects.toThrow(
      new Error('You must provide either a databaseUrl or a dbClient')
    );
  });

  it('should execute a basic up migration', async () => {
    const executedMigrations: Array<{
      id: number;
      name: string;
      run_on: Date;
    }> = [];
    let id = 1;

    const dbClient = {
      query: vi.fn((query) => {
        switch (query) {
          case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
            return Promise.resolve({
              rows: [{ lockObtained: true }], // lock obtained
            });
          }

          case MIGRATIONS_TABLE_EXISTS: {
            return Promise.resolve({
              rows: [], // no migration table
            });
          }

          case OTHER_MIGRATIONS_TABLES: {
            return Promise.resolve({
              rows: [], // no migration history in another schema either
            });
          }

          case 'CREATE TABLE "public"."pgmigrations" ( id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)': {
            return Promise.resolve({}); // migration table created
          }

          case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
            return Promise.resolve({
              rows: executedMigrations,
            });
          }

          case 'BEGIN;': {
            return Promise.resolve({}); // transaction started
          }

          case 'COMMIT;': {
            return Promise.resolve({}); // transaction committed
          }

          default: {
            if (
              query.startsWith(
                'INSERT INTO "public"."pgmigrations" (name, run_on) VALUES'
              )
            ) {
              const name: string =
                /VALUES \('([^']+)'/.exec(query as string)?.[1] ?? 'failed'; // migration name

              // insert migration
              executedMigrations.push({
                id: id++,
                name,
                run_on: new Date(),
              });

              return Promise.resolve({}); // migration inserted
            }

            break;
          }
        }

        // bypass migration queries
        return Promise.resolve({ rows: [{}] });
      }),
    } as unknown as ClientBase;

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        // We use cockroach migrations for now, as they are more simple
        // We either could mock the migration files later or define specific migrations for unit-testing
        dir: 'test/cockroach',
        direction: 'up',
      })
    ).resolves.not.toThrow();
    expect(executedMigrations).toHaveLength(12);
  });

  it('should execute a basic down migration', async () => {
    const executedMigrations: Array<{
      id: number;
      name: string;
      run_on: Date;
    }> = [
      { id: 1, name: '004_table', run_on: new Date() },
      { id: 2, name: '006_table_rename', run_on: new Date() },
    ];

    const dbClient = {
      query: vi.fn((query) => {
        switch (query) {
          case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
            return Promise.resolve({
              rows: [{ lockObtained: true }], // lock obtained
            });
          }

          case MIGRATIONS_TABLE_EXISTS: {
            return Promise.resolve({
              rows: [{}], // migration table exists
            });
          }

          case MIGRATIONS_TABLE_PRIMARY_KEY: {
            return Promise.resolve({}); // no primary key constraint found
          }

          case 'ALTER TABLE "public"."pgmigrations" ADD PRIMARY KEY (id)': {
            return Promise.resolve({}); // primary key constraint added
          }

          case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
            return Promise.resolve({
              rows: executedMigrations,
            });
          }

          case 'BEGIN;': {
            return Promise.resolve({}); // transaction started
          }

          case 'COMMIT;': {
            return Promise.resolve({}); // transaction committed
          }

          default: {
            if (
              query.startsWith(
                'DELETE FROM "public"."pgmigrations" WHERE name='
              )
            ) {
              // delete migration
              executedMigrations.pop();

              return Promise.resolve({}); // migration deleted
            }

            break;
          }
        }

        // bypass migration queries
        return Promise.resolve({ rows: [{}] });
      }),
    } as unknown as ClientBase;

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        // We use cockroach migrations for now, as they are more simple
        // We either could mock the migration files later or define specific migrations for unit-testing
        dir: 'test/cockroach',
        direction: 'down',
        count: 2,
      })
    ).resolves.not.toThrow();
    expect(executedMigrations).toHaveLength(0);
  });

  it('should call pg_advisory_lock when advisory lock mode is set to "wait"', async () => {
    const queryMock = vi.fn((query) => {
      switch (query) {
        case 'SELECT pg_advisory_lock(7241865325823964)': {
          return Promise.resolve();
        }

        case MIGRATIONS_TABLE_EXISTS: {
          return Promise.resolve({
            rows: [{}], // migration table exists
          });
        }

        case MIGRATIONS_TABLE_PRIMARY_KEY: {
          return Promise.resolve({
            rows: [{ constraint_name: 'pk_constraint' }], // primary key exists
          });
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({
            rows: [], // no migrations executed
          });
        }

        case OTHER_MIGRATIONS_TABLES: {
          return Promise.resolve({
            rows: [], // no migration history in another schema either
          });
        }

        default: {
          return Promise.resolve({ rows: [{}] }); // bypass other queries
        }
      }
    });
    const dbClient = { query: queryMock } as unknown as ClientBase;

    await expect(
      runner({
        advisoryLockMode: 'wait',
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/cockroach',
        direction: 'up',
      })
    ).resolves.not.toThrow();

    // Verify that the query with blocking lock was called
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT pg_advisory_lock(7241865325823964)',
      undefined
    );
  });

  it('should use the provided lock value', async () => {
    const customLockValue = 12345;
    const queryMock = vi.fn((query) => {
      switch (query) {
        case `SELECT pg_try_advisory_lock(${customLockValue}) AS "lockObtained"`: {
          return Promise.resolve({
            rows: [{ lockObtained: true }], // lock obtained with custom value
          });
        }

        case MIGRATIONS_TABLE_EXISTS: {
          return Promise.resolve({
            rows: [{}], // migration table exists
          });
        }

        case MIGRATIONS_TABLE_PRIMARY_KEY: {
          return Promise.resolve({
            rows: [{ constraint_name: 'pk_constraint' }], // primary key exists
          });
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({
            rows: [], // no migrations executed
          });
        }

        case OTHER_MIGRATIONS_TABLES: {
          return Promise.resolve({
            rows: [], // no migration history in another schema either
          });
        }

        default: {
          return Promise.resolve({ rows: [{}] }); // bypass other queries
        }
      }
    });
    const dbClient = { query: queryMock } as unknown as ClientBase;

    await expect(
      runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/cockroach',
        direction: 'up',
        lockValue: customLockValue,
      })
    ).resolves.not.toThrow();

    // Verify that the query with custom lock value was called
    expect(queryMock).toHaveBeenCalledWith(
      `SELECT pg_try_advisory_lock(${customLockValue}) AS "lockObtained"`,
      undefined
    );
  });

  it('should look the migrations table up in the system catalogs, passing its names as parameters', async () => {
    const queryMock = vi.fn((query: string) => {
      switch (query) {
        case 'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"': {
          return Promise.resolve({ rows: [{ lockObtained: true }] });
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({ rows: [{ name: '004_table' }] });
        }

        default: {
          return Promise.resolve({ rows: [{}] }); // the table and its primary key exist
        }
      }
    });

    await runner({
      dbClient: { query: queryMock } as unknown as ClientBase,
      migrationsTable: 'pgmigrations',
      dir: 'test/cockroach',
      direction: 'up',
    });

    expect(queryMock).toHaveBeenCalledWith(MIGRATIONS_TABLE_EXISTS, [
      'pgmigrations',
      'public',
    ]);
    expect(queryMock).toHaveBeenCalledWith(MIGRATIONS_TABLE_PRIMARY_KEY, [
      'pgmigrations',
      'public',
    ]);
  });

  describe('dry run', () => {
    const AUTOCOMMIT_SETTING =
      "SELECT current_setting('autocommit_before_ddl', true) AS setting";

    /**
     * A client that answers everything a dry run legitimately asks. `autocommitBeforeDdl`
     * mimics the CockroachDB session setting: `undefined` is what PostgreSQL (and
     * CockroachDB before v24.3) reports for an unknown setting.
     */
    function createDbClient(
      options: {
        migrationsTableExists?: boolean;
        autocommitBeforeDdl?: string;
        acceptsAutocommitSet?: boolean;
        rejectDirectWrites?: boolean;
      } = {}
    ): { dbClient: ClientBase; queryMock: Mock } {
      const {
        migrationsTableExists = false,
        acceptsAutocommitSet = true,
        rejectDirectWrites = false,
      } = options;
      let { autocommitBeforeDdl } = options;

      const queryMock = vi.fn((query: string) => {
        if (
          rejectDirectWrites &&
          query.startsWith('CREATE TABLE direct_write_table')
        ) {
          return Promise.reject(
            Object.assign(
              new Error(
                'cannot execute CREATE TABLE in a read-only transaction'
              ),
              { code: '25006' }
            )
          );
        }

        if (query === MIGRATIONS_TABLE_EXISTS) {
          return Promise.resolve({ rows: migrationsTableExists ? [{}] : [] });
        }

        if (query === OTHER_MIGRATIONS_TABLES) {
          return Promise.resolve({ rows: [] });
        }

        if (query.startsWith('SELECT name FROM ')) {
          return Promise.resolve({ rows: [] });
        }

        switch (query) {
          case AUTOCOMMIT_SETTING: {
            return Promise.resolve({
              rows: [{ setting: autocommitBeforeDdl }],
            });
          }

          case 'SET autocommit_before_ddl = false': {
            if (acceptsAutocommitSet) {
              autocommitBeforeDdl = 'off';
            }

            return Promise.resolve({ rows: [] });
          }

          default: {
            return Promise.resolve({ rows: [{}] });
          }
        }
      });

      return {
        dbClient: { query: queryMock } as unknown as ClientBase,
        queryMock,
      };
    }

    function executedQueries(queryMock: Mock): string[] {
      return queryMock.mock.calls.map((call) => String(call[0]));
    }

    it('should wrap the whole run in a read-only transaction', async () => {
      const { dbClient, queryMock } = createDbClient();

      await expect(
        runner({
          dbClient,
          migrationsTable: 'pgmigrations',
          dir: 'test/dry-run-migrations',
          direction: 'up',
          dryRun: true,
        })
      ).resolves.toHaveLength(1);

      const queries = executedQueries(queryMock);

      expect(queries).toContain('BEGIN');
      expect(queries).toContain('SET TRANSACTION READ ONLY');
      expect(queries).toContain('ROLLBACK');
      // The read-only transaction must be in place before anything else happens.
      expect(queries.indexOf('SET TRANSACTION READ ONLY')).toBe(
        queries.indexOf('BEGIN') + 1
      );
    });

    it('should not take the advisory lock', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
      });

      expect(executedQueries(queryMock)).not.toContain(
        'SELECT pg_try_advisory_lock(7241865325823964) AS "lockObtained"'
      );
    });

    it('should not create the migrations table', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
      });

      expect(executedQueries(queryMock)).not.toContain(
        'CREATE TABLE "public"."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
    });

    it('should not create schemas', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
        schema: 'app',
        createSchema: true,
        migrationsSchema: 'meta',
        createMigrationsSchema: true,
      });

      expect(
        executedQueries(queryMock).filter((query) =>
          query.startsWith('CREATE SCHEMA')
        )
      ).toHaveLength(0);
    });

    it('should not run the migration statements', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
      });

      const queries = executedQueries(queryMock);

      expect(
        queries.filter((query) =>
          query.includes('CREATE TABLE "dry_run_table"')
        )
      ).toHaveLength(0);
      expect(
        queries.filter((query) =>
          query.startsWith('INSERT INTO "public"."pgmigrations"')
        )
      ).toHaveLength(0);
    });

    it('should not mark migrations as run when combined with fake', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
        fake: true,
      });

      expect(
        executedQueries(queryMock).filter((query) =>
          query.startsWith('INSERT INTO "public"."pgmigrations"')
        )
      ).toHaveLength(0);
    });

    it('should turn off autocommit_before_ddl when the server enables it', async () => {
      const { dbClient, queryMock } = createDbClient({
        autocommitBeforeDdl: 'on',
      });

      await expect(
        runner({
          dbClient,
          migrationsTable: 'pgmigrations',
          dir: 'test/dry-run-migrations',
          direction: 'up',
          dryRun: true,
        })
      ).resolves.toHaveLength(1);

      const queries = executedQueries(queryMock);

      expect(queries).toContain('SET autocommit_before_ddl = false');
      expect(queries.indexOf('SET autocommit_before_ddl = false')).toBeLessThan(
        queries.indexOf('BEGIN')
      );
    });

    it('should not touch autocommit_before_ddl when the server does not know it', async () => {
      const { dbClient, queryMock } = createDbClient();

      await runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/dry-run-migrations',
        direction: 'up',
        dryRun: true,
      });

      expect(executedQueries(queryMock)).not.toContain(
        'SET autocommit_before_ddl = false'
      );
    });

    it('should refuse to run when autocommit_before_ddl cannot be turned off', async () => {
      const { dbClient, queryMock } = createDbClient({
        autocommitBeforeDdl: 'on',
        acceptsAutocommitSet: false,
      });

      await expect(
        runner({
          dbClient,
          migrationsTable: 'pgmigrations',
          dir: 'test/dry-run-migrations',
          direction: 'up',
          dryRun: true,
        })
      ).rejects.toThrow(
        'Refusing to dry run: this server auto-commits DDL (autocommit_before_ddl = on)'
      );

      // Nothing may happen once the guarantee cannot be given - not even a transaction.
      expect(executedQueries(queryMock)).not.toContain('BEGIN');
    });

    it('should explain a write that the read-only transaction refuses', async () => {
      const { dbClient } = createDbClient({ rejectDirectWrites: true });

      await expect(
        runner({
          dbClient,
          migrationsTable: 'pgmigrations',
          dir: 'test/dry-run-direct-write',
          direction: 'up',
          dryRun: true,
        })
      ).rejects.toThrow(
        'This migration writes to the database directly (e.g. through `pgm.db.query(...)`), which a dry run refuses'
      );
    });
  });

  describe('migration history', () => {
    interface MigrationsTable {
      /**
       * Names of the migrations the table records.
       */
      runNames?: string[];
      readable?: boolean;
    }

    /**
     * A client for a database holding the given migrations tables, keyed by schema. It answers
     * the runner's own bookkeeping queries and accepts everything else.
     */
    function createDbClient(tables: Record<string, MigrationsTable> = {}): {
      dbClient: ClientBase;
      queryMock: Mock;
    } {
      const tableIn = (query: string, pattern: RegExp): MigrationsTable =>
        tables[pattern.exec(query)?.[1] ?? ''] ?? {};

      const queryMock = vi.fn((query: string, values?: unknown[]) => {
        if (query === MIGRATIONS_TABLE_EXISTS) {
          return Promise.resolve({
            rows: Object.hasOwn(tables, String(values?.[1])) ? [{}] : [],
          });
        }

        if (
          query === OTHER_MIGRATIONS_TABLES ||
          query === OTHER_MIGRATIONS_TABLES_IN_LIST
        ) {
          const [, ownSchema, , searched] = values ?? [];

          return Promise.resolve({
            rows: Object.entries(tables)
              .filter(
                ([schema]) =>
                  schema !== ownSchema &&
                  (!Array.isArray(searched) || searched.includes(schema))
              )
              .map(([schema, { readable = true }]) => ({ schema, readable })),
          });
        }

        if (query.endsWith(' LIMIT 1')) {
          const { runNames = [] } = tableIn(query, /^SELECT 1 FROM "([^"]+)"/);

          return Promise.resolve({
            rows: runNames.slice(0, 1).map(() => ({})),
          });
        }

        if (query.startsWith('SELECT name FROM ')) {
          const { runNames = [] } = tableIn(
            query,
            /^SELECT name FROM "([^"]+)"/
          );

          return Promise.resolve({ rows: runNames.map((name) => ({ name })) });
        }

        if (query.startsWith('SELECT pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ lockObtained: true }] });
        }

        if (query.startsWith('SELECT pg_advisory_unlock')) {
          return Promise.resolve({ rows: [{ lockReleased: true }] });
        }

        return Promise.resolve({ rows: [{}] });
      });

      return {
        dbClient: { query: queryMock } as unknown as ClientBase,
        queryMock,
      };
    }

    function executedQueries(queryMock: Mock): string[] {
      return queryMock.mock.calls.map((call) => String(call[0]));
    }

    function historyScans(queryMock: Mock): string[] {
      return executedQueries(queryMock).filter(
        (query) =>
          query === OTHER_MIGRATIONS_TABLES ||
          query === OTHER_MIGRATIONS_TABLES_IN_LIST
      );
    }

    function run(
      dbClient: ClientBase,
      options: Partial<RunnerOptionConfig> = {}
    ): Promise<RunMigration[]> {
      return runner({
        dbClient,
        migrationsTable: 'pgmigrations',
        dir: 'test/cockroach',
        direction: 'up',
        logger: {
          info: vi.fn<LogFn>(),
          warn: vi.fn<LogFn>(),
          error: vi.fn<LogFn>(),
        },
        ...options,
      });
    }

    /**
     * A refused run stops before it creates, records or applies anything - before it even sets
     * the `search_path`.
     */
    function expectNoWrites(queryMock: Mock): void {
      expect(
        executedQueries(queryMock).filter((query) =>
          /^(CREATE|ALTER|INSERT|DELETE|SET search_path)/.test(query)
        )
      ).toEqual([]);
    }

    const history: MigrationsTable = { runNames: ['004_table'] };

    it('should carry on from the history where the run expects it, without looking elsewhere', async () => {
      const { dbClient, queryMock } = createDbClient({
        public: history,
        app: history,
      });

      await expect(run(dbClient)).resolves.toHaveLength(11);

      expect(historyScans(queryMock)).toEqual([]);
    });

    it('should start a new history when the database has none', async () => {
      const { dbClient, queryMock } = createDbClient();

      await expect(run(dbClient)).resolves.toHaveLength(12);

      expect(queryMock).toHaveBeenCalledWith(OTHER_MIGRATIONS_TABLES, [
        'pgmigrations',
        'public',
        ['id', 'name', 'run_on'],
      ]);
      expect(executedQueries(queryMock)).toContain(
        'CREATE TABLE "public"."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
    });

    it('should refuse to start over when no schema was given and another schema holds the history', async () => {
      const { dbClient, queryMock } = createDbClient({ app: history });

      await expect(run(dbClient)).rejects.toThrow(
        new Error(
          'Refusing to run: the migrations table "public"."pgmigrations" does not exist, but "app"."pgmigrations" already records migrations. Carrying on would start the history over and could apply migrations that have already run. No schema was configured, so "public" is only the fallback. To continue that history, pass `--schema app` (or `--migrations-schema app` if only the migrations table lives there); to start a new one in "public", pass `--migrations-schema public`. From the API, use the `schema` and `migrationsSchema` options.'
        )
      );

      expectNoWrites(queryMock);
    });

    it('should refuse the same way when the migrations table exists but is empty', async () => {
      const { dbClient, queryMock } = createDbClient({
        public: { runNames: [] },
        app: history,
      });

      await expect(run(dbClient, { direction: 'down' })).rejects.toThrow(
        'Refusing to run: the migrations table "public"."pgmigrations" is empty, but "app"."pgmigrations" already records migrations.'
      );

      expectNoWrites(queryMock);
    });

    it('should not trust a schema that is only a default the CLI filled in', async () => {
      const { dbClient, queryMock } = createDbClient({ app: history });

      await expect(
        run(dbClient, {
          schema: ['public'],
          schemaIsDefault: true,
          createSchema: true,
          fake: true,
        })
      ).rejects.toThrow('No schema was configured');

      // Not even the schema: a refused run leaves the database as it found it.
      expectNoWrites(queryMock);
    });

    it('should treat a run without a schema as a fallback, whatever schemaIsDefault says', async () => {
      const { dbClient } = createDbClient({ app: history });

      await expect(run(dbClient, { schemaIsDefault: false })).rejects.toThrow(
        'No schema was configured'
      );
    });

    it('should not count an empty schema list as a choice', async () => {
      const { dbClient } = createDbClient({ app: history });

      await expect(run(dbClient, { schema: [] })).rejects.toThrow(
        'No schema was configured'
      );
    });

    it('should start a new history in a schema the user chose, as for another tenant', async () => {
      const { dbClient, queryMock } = createDbClient({ tenant_a: history });

      await expect(
        run(dbClient, {
          schema: 'tenant_b',
          createSchema: true,
        })
      ).resolves.toHaveLength(12);

      const queries = executedQueries(queryMock);

      expect(historyScans(queryMock)).toEqual([]);
      expect(queries).toContain('CREATE SCHEMA IF NOT EXISTS "tenant_b"');
      expect(queries).toContain(
        'CREATE TABLE "tenant_b"."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
    });

    it('should refuse when the history is further down the chosen schema list', async () => {
      const { dbClient, queryMock } = createDbClient({ app: history });

      await expect(
        run(dbClient, { schema: ['public', 'app'] })
      ).rejects.toThrow(
        'The migrations table follows the first `--schema` entry, and "app" is further down that list. To continue that history, pass `--migrations-schema app` (or list "app" first); to start a new one in "public", pass `--migrations-schema public`.'
      );

      // Only the rest of the list is searched, and the database does the narrowing.
      expect(queryMock).toHaveBeenCalledWith(OTHER_MIGRATIONS_TABLES_IN_LIST, [
        'pgmigrations',
        'public',
        ['id', 'name', 'run_on'],
        ['app'],
      ]);
      expectNoWrites(queryMock);
    });

    it('should leave histories outside the chosen schema list to their own tenants', async () => {
      const { dbClient } = createDbClient({ tenant_a: history });

      await expect(
        run(dbClient, { schema: ['tenant_b', 'shared'] })
      ).resolves.toHaveLength(12);
    });

    it('should not count an empty table in another schema as a history', async () => {
      const { dbClient } = createDbClient({ app: { runNames: [] } });

      await expect(run(dbClient)).resolves.toHaveLength(12);
    });

    it('should refuse when a table in another schema cannot be read', async () => {
      const { dbClient, queryMock } = createDbClient({
        app: { ...history, readable: false },
      });

      await expect(run(dbClient)).rejects.toThrow(
        'but "app"."pgmigrations" exists and cannot be read by this role.'
      );

      // Reading it would only fail with a permissions error.
      expect(executedQueries(queryMock)).not.toContain(
        'SELECT 1 FROM "app"."pgmigrations" LIMIT 1'
      );
    });

    it('should take an explicit migrationsSchema at its word', async () => {
      const { dbClient, queryMock } = createDbClient({ app: history });

      await expect(
        run(dbClient, { migrationsSchema: 'meta' })
      ).resolves.toHaveLength(12);

      expect(historyScans(queryMock)).toEqual([]);
    });

    it('should refuse a dry run the same way, and end its read-only transaction', async () => {
      const { dbClient, queryMock } = createDbClient({ app: history });

      await expect(run(dbClient, { dryRun: true })).rejects.toThrow(
        'Refusing to run'
      );

      expect(executedQueries(queryMock).at(-1)).toBe('ROLLBACK');
    });

    it('should use the configured migrations table and schema names as they are under decamelize', async () => {
      const { dbClient, queryMock } = createDbClient();

      await run(dbClient, {
        migrationsTable: 'pgMigrations',
        schema: 'myApp',
        createSchema: true,
        decamelize: true,
      });

      const queries = executedQueries(queryMock);

      expect(queryMock).toHaveBeenCalledWith(MIGRATIONS_TABLE_EXISTS, [
        'pgMigrations',
        'myApp',
      ]);
      expect(queries).toContain('CREATE SCHEMA IF NOT EXISTS "myApp"');
      expect(queries).toContain('SET search_path TO "myApp"');
      expect(queries).toContain(
        'CREATE TABLE "myApp"."pgMigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)'
      );
      expect(
        queries.filter((query) =>
          query.startsWith('INSERT INTO "myApp"."pgMigrations" (name, run_on)')
        )
      ).toHaveLength(12);
    });
  });
});
