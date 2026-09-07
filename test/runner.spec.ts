import type { ClientBase } from 'pg';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { runner } from '../src';

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

          case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
            return Promise.resolve({
              rows: [], // no migration table
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

          case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
            return Promise.resolve({
              rows: [{}], // migration table exists
            });
          }

          case "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'pgmigrations' AND constraint_type = 'PRIMARY KEY'": {
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

        case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
          return Promise.resolve({
            rows: [{}], // migration table exists
          });
        }

        case "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'pgmigrations' AND constraint_type = 'PRIMARY KEY'": {
          return Promise.resolve({
            rows: [{ constraint_name: 'pk_constraint' }], // primary key exists
          });
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({
            rows: [], // no migrations executed
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

        case "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pgmigrations'": {
          return Promise.resolve({
            rows: [{}], // migration table exists
          });
        }

        case "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'pgmigrations' AND constraint_type = 'PRIMARY KEY'": {
          return Promise.resolve({
            rows: [{ constraint_name: 'pk_constraint' }], // primary key exists
          });
        }

        case 'SELECT name FROM "public"."pgmigrations" ORDER BY run_on, id': {
          return Promise.resolve({
            rows: [], // no migrations executed
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

        // Matched by shape rather than by exact text, so the mock keeps working when the
        // migrations table lives in another schema.
        if (
          query.startsWith('SELECT table_name FROM information_schema.tables')
        ) {
          return Promise.resolve({ rows: migrationsTableExists ? [{}] : [] });
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
});
