import { setTimeout as sleep } from 'node:timers/promises';
import type { ClientBase } from 'pg';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runner } from '../src';
import * as db from '../src/db';
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
  describe('transaction cleanup', () => {
    function setup(failedSql: string, rollbackError?: unknown) {
      const error = new Error('original failure');
      const rejectRollback = vi.fn().mockRejectedValue(rollbackError);
      const query = vi.fn((sql: string) => {
        if (sql.startsWith(failedSql)) {
          return Promise.reject(error);
        }
        if (sql === 'ROLLBACK' && rollbackError !== undefined) {
          return rejectRollback();
        }
        if (sql.includes('pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ lockObtained: true }] });
        }
        if (sql.includes('pg_advisory_unlock')) {
          return Promise.resolve({ rows: [{ lockReleased: true }] });
        }
        return Promise.resolve({ rows: [] });
      });
      const end = vi.fn();
      const dbClient = { query, end } as unknown as ClientBase;
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const run = (options: Partial<RunnerOptionConfig> = {}) =>
        runner({
          dbClient,
          logger,
          dir: 'test/dry-run-migrations',
          migrationsTable: 'pgmigrations',
          direction: 'up',
          ...options,
        });
      return { error, query, end, logger, run };
    }

    it.each([false, undefined, true])(
      'rolls back before unlocking (singleTransaction=%s)',
      async (singleTransaction) => {
        const { error, query, end, run } = setup(
          'CREATE TABLE "dry_run_table"'
        );
        await expect(run({ singleTransaction })).rejects.toBe(error);
        const cleanup = query.mock.calls
          .map(([sql]) => sql)
          .filter(
            (sql) =>
              sql.startsWith('ROLLBACK') || sql.includes('pg_advisory_unlock')
          );
        expect(cleanup).toEqual([
          singleTransaction ? 'ROLLBACK' : 'ROLLBACK;',
          'SELECT pg_advisory_unlock(7241865325823964) AS "lockReleased"',
        ]);
        expect(end).not.toHaveBeenCalled();
      }
    );

    it.each([new Error('rollback failed'), 'rollback failed'])(
      'preserves the original error if global rollback fails with %s',
      async (rollbackError) => {
        const { error, query, end, logger, run } = setup(
          'CREATE TABLE "dry_run_table"',
          rollbackError
        );
        await expect(run({ singleTransaction: true })).rejects.toBe(error);
        expect(logger.warn).toHaveBeenCalledWith('rollback failed');
        expect(query).toHaveBeenLastCalledWith(
          'SELECT pg_advisory_unlock(7241865325823964) AS "lockReleased"',
          undefined
        );
        expect(end).not.toHaveBeenCalled();
      }
    );

    it('does not roll back a global transaction that failed to start', async () => {
      const { error, query, run } = setup('BEGIN');
      await expect(run({ singleTransaction: true })).rejects.toBe(error);
      expect(query.mock.calls.map(([sql]) => sql)).not.toContain('ROLLBACK');
    });

    it.each([undefined, new Error('rollback failed'), 'rollback failed'])(
      'cleans up a failed read-only setup and preserves its error (rollback error=%s)',
      async (rollbackError) => {
        const { error, query, end, logger, run } = setup(
          'SET TRANSACTION READ ONLY',
          rollbackError
        );
        await expect(run({ dryRun: true })).rejects.toBe(error);
        expect(query.mock.calls.map(([sql]) => sql)).toEqual([
          "SELECT current_setting('autocommit_before_ddl', true) AS setting",
          'BEGIN',
          'SET TRANSACTION READ ONLY',
          'ROLLBACK',
        ]);
        expect(logger.warn.mock.calls).toEqual(
          rollbackError === undefined ? [] : [['rollback failed']]
        );
        expect(end).not.toHaveBeenCalled();
      }
    );

    it('does not roll back a dry-run transaction that failed to start', async () => {
      const { error, query, run } = setup('BEGIN');
      await expect(run({ dryRun: true })).rejects.toBe(error);
      expect(query.mock.calls.map(([sql]) => sql)).toEqual([
        "SELECT current_setting('autocommit_before_ddl', true) AS setting",
        'BEGIN',
      ]);
    });
  });

  describe('CockroachDB transaction safety', () => {
    const AUTOCOMMIT_SETTING =
      "SELECT current_setting('autocommit_before_ddl', true) AS setting";
    const DISABLE_AUTOCOMMIT = 'SET autocommit_before_ddl = false';
    const RESTORE_AUTOCOMMIT = 'SET autocommit_before_ddl = $pga$on$pga$';
    const REFUSAL = 'Refusing to run with singleTransaction';
    const MIGRATION_NAME = '1000_dry_run_table';

    function setup(
      options: {
        autocommitBeforeDdl?: string | null;
        verifiedSetting?: string | null;
        setError?: Error;
        verificationError?: Error;
        restorationError?: unknown;
        failedSql?: string;
        migrationError?: Error;
        history?: string[];
      } = {}
    ) {
      const {
        autocommitBeforeDdl = 'on',
        setError,
        verificationError,
        restorationError,
        failedSql,
        migrationError = new Error('migration failed'),
        history = [],
      } = options;
      let setting = autocommitBeforeDdl;
      let settingReads = 0;
      const events: string[] = [];
      const rejectRestoration = vi.fn().mockRejectedValue(restorationError);
      const query = vi.fn((sql: string) => {
        events.push(sql);
        if (sql === AUTOCOMMIT_SETTING) {
          settingReads += 1;
          if (settingReads > 1 && verificationError !== undefined) {
            return Promise.reject(verificationError);
          }
          return Promise.resolve({ rows: [{ setting }] });
        }
        if (sql === DISABLE_AUTOCOMMIT) {
          if (setError !== undefined) {
            return Promise.reject(setError);
          }
          setting = Object.hasOwn(options, 'verifiedSetting')
            ? (options.verifiedSetting ?? null)
            : 'off';
        }
        if (
          sql.startsWith('SET autocommit_before_ddl = ') &&
          sql !== DISABLE_AUTOCOMMIT
        ) {
          if (restorationError !== undefined) {
            return rejectRestoration();
          }
          setting = autocommitBeforeDdl;
        }
        if (failedSql !== undefined && sql.startsWith(failedSql)) {
          return Promise.reject(migrationError);
        }
        if (sql.includes('pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ lockObtained: true }] });
        }
        if (sql.includes('pg_advisory_unlock')) {
          return Promise.resolve({ rows: [{ lockReleased: true }] });
        }
        if (sql === MIGRATIONS_TABLE_EXISTS) {
          return Promise.resolve({ rows: history.length > 0 ? [{}] : [] });
        }
        if (sql === OTHER_MIGRATIONS_TABLES) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.startsWith('SELECT name FROM ')) {
          return Promise.resolve({ rows: history.map((name) => ({ name })) });
        }
        if (sql.startsWith('DELETE FROM ')) {
          history.splice(0);
        }
        return Promise.resolve({ rows: [{}] });
      });
      const end = vi.fn();
      const dbClient = { query, end } as unknown as ClientBase;
      const logger = {
        info: vi.fn(),
        warn: vi.fn((message: string) => {
          events.push(message);
        }),
        error: vi.fn(),
      };
      const run = (runOptions: Partial<RunnerOptionConfig> = {}) =>
        runner({
          dbClient,
          logger,
          dir: 'test/dry-run-migrations',
          migrationsTable: 'pgmigrations',
          direction: 'up',
          singleTransaction: true,
          ...runOptions,
        });
      const statements = () => query.mock.calls.map(([sql]) => sql);
      const transactions = () =>
        statements().filter((sql) => /^(BEGIN|COMMIT|ROLLBACK);?$/.test(sql));

      return {
        run,
        query,
        logger,
        dbClient,
        end,
        migrationError,
        statements,
        transactions,
        events,
      };
    }

    it.each(['up', 'down', 'redo'] as const)(
      'disables DDL autocommit before setup and restores the caller session after %s',
      async (direction) => {
        const { run, statements, transactions, end } = setup({
          history: direction === 'up' ? [] : [MIGRATION_NAME],
        });

        await expect(run({ direction })).resolves.toHaveLength(
          direction === 'redo' ? 2 : 1
        );

        const sql = statements();
        expect(sql.slice(0, 3)).toEqual([
          AUTOCOMMIT_SETTING,
          DISABLE_AUTOCOMMIT,
          AUTOCOMMIT_SETTING,
        ]);
        expect(sql.at(-1)).toBe(RESTORE_AUTOCOMMIT);
        expect(sql.at(-2)).toContain('pg_advisory_unlock');
        expect(transactions()).toEqual(['BEGIN', 'COMMIT']);
        expect(end).not.toHaveBeenCalled();
      }
    );

    it.each([null, 'off', 'false', 'OFF'])(
      'leaves disabled or unsupported autocommit_before_ddl unchanged (%s)',
      async (autocommitBeforeDdl) => {
        const { run, statements } = setup({ autocommitBeforeDdl });

        await expect(run()).resolves.toHaveLength(1);

        expect(statements()).toContain(AUTOCOMMIT_SETTING);
        expect(statements()).not.toContain(DISABLE_AUTOCOMMIT);
        expect(
          statements().filter((sql) =>
            sql.startsWith('SET autocommit_before_ddl = ')
          )
        ).toEqual([]);
      }
    );

    it.each(['off', 'false', 'OFF'])(
      'accepts a confirmed disabled setting (%s)',
      async (verifiedSetting) => {
        const { run } = setup({ verifiedSetting });

        await expect(run()).resolves.toHaveLength(1);
      }
    );

    it.each([
      ['on', 'SET autocommit_before_ddl = $pga$on$pga$'],
      ['true', 'SET autocommit_before_ddl = $pga$true$pga$'],
      ['ON', 'SET autocommit_before_ddl = $pga$on$pga$'],
    ])(
      'restores the captured enabled setting reported as %s',
      async (autocommitBeforeDdl, restoreSql) => {
        const { run, statements } = setup({ autocommitBeforeDdl });

        await expect(run()).resolves.toHaveLength(1);

        expect(statements()).toContain(DISABLE_AUTOCOMMIT);
        expect(statements().at(-1)).toBe(restoreSql);
      }
    );

    function expectNoUnsafeSetup(sql: string[]): void {
      expect(
        sql.filter((statement) =>
          /^(BEGIN|CREATE|ALTER|INSERT|DELETE|SET search_path)/.test(statement)
        )
      ).toEqual([]);
      expect(
        sql.some((statement) => statement.includes('pg_try_advisory_lock'))
      ).toBe(false);
      expect(
        sql.some((statement) => statement.includes('pg_advisory_unlock'))
      ).toBe(false);
      expect(sql.at(-1)).toBe(RESTORE_AUTOCOMMIT);
    }

    it.each([
      { setError: new Error('cannot set autocommit_before_ddl') },
      { verificationError: new Error('cannot read autocommit_before_ddl') },
    ])(
      'preserves guard failures before locking or writing (%j)',
      async (options) => {
        const { run, statements } = setup(options);
        const error =
          'setError' in options ? options.setError : options.verificationError;

        await expect(
          run({
            createSchema: true,
            schema: 'app',
            createMigrationsSchema: true,
            migrationsSchema: 'meta',
          })
        ).rejects.toBe(error);

        expectNoUnsafeSetup(statements());
      }
    );

    it.each(['on', null, 'unexpected'])(
      'refuses an unconfirmed disabled setting before locking or writing (%s)',
      async (verifiedSetting) => {
        const { run, statements } = setup({ verifiedSetting });

        const error: unknown = await run().catch((error: unknown) => error);

        expect(error).toBeInstanceOf(Error);
        expect(String(error)).toContain(REFUSAL);
        expect(String(error)).toContain('--single-transaction');
        expect(String(error)).toContain('role or database');
        expect(String(error)).toContain('autocommit_before_ddl');
        expect(String(error)).toContain('singleTransaction: false');
        expect(String(error)).toContain('--no-single-transaction');

        expectNoUnsafeSetup(statements());
      }
    );

    it('restores the caller session even when no migrations are pending', async () => {
      const { run, statements, transactions } = setup({
        history: [MIGRATION_NAME],
      });

      await expect(run()).resolves.toEqual([]);

      expect(transactions()).toEqual([]);
      expect(statements().at(-1)).toBe(RESTORE_AUTOCOMMIT);
    });

    it('rolls back and releases the lock before restoring the caller session after a failure', async () => {
      const { run, statements, migrationError } = setup({
        failedSql: 'CREATE TABLE "dry_run_table"',
      });

      await expect(run()).rejects.toBe(migrationError);

      expect(statements().slice(-3)).toEqual([
        'ROLLBACK',
        'SELECT pg_advisory_unlock(7241865325823964) AS "lockReleased"',
        RESTORE_AUTOCOMMIT,
      ]);
    });

    it.each([false, true])(
      'restores a dry-run caller session after cleanup (migration fails=%s)',
      async (fails) => {
        const { run, statements, migrationError } = setup({
          failedSql: fails ? 'SET TRANSACTION READ ONLY' : undefined,
        });

        const error = await run({ dryRun: true }).then(
          () => null,
          (error: unknown) => error
        );

        expect(error).toBe(fails ? migrationError : null);

        expect(statements().slice(-2)).toEqual([
          'ROLLBACK',
          RESTORE_AUTOCOMMIT,
        ]);
      }
    );

    it.each([new Error('restore failed'), 'restore failed'])(
      'reports restoration failure without replacing the migration error (%s)',
      async (restorationError) => {
        const { run, logger, migrationError } = setup({
          failedSql: 'CREATE TABLE "dry_run_table"',
          restorationError,
        });

        await expect(run()).rejects.toBe(migrationError);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /restor.*autocommit_before_ddl.*restore failed/i
          )
        );
      }
    );

    it('keeps a successful result when restoring the caller session fails', async () => {
      const { run, logger } = setup({
        restorationError: new Error('restore failed'),
      });

      await expect(run()).resolves.toHaveLength(1);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/restor.*autocommit_before_ddl.*restore failed/i)
      );
    });

    it('preserves a guard refusal when restoring the caller session also fails', async () => {
      const { run, logger } = setup({
        verifiedSetting: 'on',
        restorationError: new Error('restore failed'),
      });

      await expect(run()).rejects.toThrow(REFUSAL);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/restor.*autocommit_before_ddl.*restore failed/i)
      );
    });

    it('closes an owned connection instead of restoring its setting', async () => {
      const { dbClient, logger, statements } = setup();
      const connection = db.db(dbClient, logger);
      const close = vi.spyOn(connection, 'close');
      const createDb = vi.spyOn(db, 'db').mockReturnValue(connection);

      try {
        await expect(
          runner({
            databaseUrl: 'postgres://localhost/unused',
            logger,
            dir: 'test/dry-run-migrations',
            migrationsTable: 'pgmigrations',
            direction: 'up',
            singleTransaction: true,
          })
        ).resolves.toHaveLength(1);

        expect(statements()).toContain(DISABLE_AUTOCOMMIT);
        expect(statements()).not.toContain(RESTORE_AUTOCOMMIT);
        expect(close).toHaveBeenCalledOnce();
      } finally {
        createDb.mockRestore();
      }
    });

    it.each([false, undefined])(
      'preserves runs without a shared transaction (singleTransaction=%s)',
      async (singleTransaction) => {
        const { run, statements, transactions } = setup();

        await expect(run({ singleTransaction })).resolves.toHaveLength(1);

        expect(statements()).not.toContain(AUTOCOMMIT_SETTING);
        expect(statements()).not.toContain(DISABLE_AUTOCOMMIT);
        expect(statements()).not.toContain(RESTORE_AUTOCOMMIT);
        expect(transactions()).toEqual(['BEGIN;', 'COMMIT;']);
      }
    );

    it('preserves the explicit noTransaction escape from the shared transaction', async () => {
      const { run, transactions, statements, logger } = setup();

      await expect(
        run({ dir: 'test/cockroach', file: '062_view' })
      ).resolves.toHaveLength(1);

      expect(transactions()).toEqual(['BEGIN', 'COMMIT;', 'BEGIN;', 'COMMIT']);
      expect(logger.warn).toHaveBeenCalledWith(
        '#> WARNING: Need to break single transaction! <'
      );
      expect(statements().at(-1)).toBe(RESTORE_AUTOCOMMIT);
    });

    it('warns that XXA00 may have committed changes before rolling back and preserves the error', async () => {
      const migrationError = Object.assign(new Error('transaction committed'), {
        code: 'XXA00',
      });
      const { run, logger, events } = setup({
        failedSql: 'COMMIT',
        migrationError,
      });

      await expect(run()).rejects.toBe(migrationError);

      const warning = logger.warn.mock.calls
        .map(([message]) => message)
        .find((message) => message.includes('XXA00'));
      expect(warning).toMatch(/partial.*commit|commit.*partial/i);
      expect(warning).toMatch(/ROLLBACK cannot undo/i);
      expect(warning).toMatch(/schema.*data.*history/i);
      expect(events.indexOf(String(warning))).toBeLessThan(
        events.indexOf('ROLLBACK')
      );
    });
  });

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

  describe('migrationsTable', () => {
    describe('rejects', () => {
      beforeEach(() => {
        vi.spyOn(db, 'db').mockImplementation(() => {
          throw new Error('Database must not be initialized');
        });
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it.each([false, true])(
        'rejects an omitted migrationsTable before using an external client (dryRun=%s)',
        async (dryRun) => {
          const query = vi.fn();
          const end = vi.fn();
          const dbClient = { query, end } as unknown as ClientBase;

          await expect(
            // @ts-expect-error: JavaScript callers can omit migrationsTable
            runner({
              dbClient,
              dir: 'test/migrations',
              direction: 'up',
              dryRun,
            })
          ).rejects.toThrow(
            new TypeError('migrationsTable must be a non-empty string')
          );

          expect(db.db).not.toHaveBeenCalled();
          expect(query).not.toHaveBeenCalled();
          expect(end).not.toHaveBeenCalled();
        }
      );

      it.each([undefined, null, '', 42, false, {}, []].map((value) => [value]))(
        'rejects invalid migrationsTable %j before creating a database client',
        async (migrationsTable) => {
          await expect(
            runner({
              databaseUrl: 'postgres://localhost/unused',
              dir: 'test/migrations',
              direction: 'up',
              migrationsTable: migrationsTable as string,
            })
          ).rejects.toThrow(
            new TypeError('migrationsTable must be a non-empty string')
          );

          expect(db.db).not.toHaveBeenCalled();
        }
      );
    });

    // Checks that explicitly supplied names are not trimmed.
    it.each(['undefined', ' '])(
      'accepts the explicit migrations table name %j without changing it',
      async (migrationsTable) => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const dbClient = { query } as unknown as ClientBase;

        await expect(
          runner({
            dbClient,
            dir: 'test/dry-run-migrations',
            direction: 'up',
            migrationsTable,
            noLock: true,
            fake: true,
            logger: {
              info: vi.fn<LogFn>(),
              warn: vi.fn<LogFn>(),
              error: vi.fn<LogFn>(),
            },
          })
        ).resolves.toHaveLength(1);

        expect(query).toHaveBeenCalledWith(MIGRATIONS_TABLE_EXISTS, [
          migrationsTable,
          'public',
        ]);
        expect(query).toHaveBeenCalledWith(
          `CREATE TABLE "public"."${migrationsTable}" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)`,
          undefined
        );
      }
    );
  });

  describe('migrationsSchema', () => {
    describe('rejects', () => {
      beforeEach(() => {
        vi.spyOn(db, 'db').mockImplementation(() => {
          throw new Error('Database must not be initialized');
        });
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it.each([false, true])(
        'rejects an empty schema before creating a database client (dryRun=%s)',
        async (dryRun) => {
          await expect(
            runner({
              databaseUrl: 'postgres://localhost/unused',
              dir: 'test/migrations',
              direction: 'up',
              migrationsTable: 'pgmigrations',
              migrationsSchema: '',
              dryRun,
            })
          ).rejects.toThrow(
            new TypeError(
              'migrationsSchema must be a non-empty string when supplied'
            )
          );
          expect(db.db).not.toHaveBeenCalled();
        }
      );

      it.each([false, true])(
        'rejects an empty schema without using an external client (dryRun=%s)',
        async (dryRun) => {
          const query = vi.fn();
          const end = vi.fn();
          const dbClient = { query, end } as unknown as ClientBase;
          await expect(
            runner({
              dbClient,
              dir: 'test/migrations',
              direction: 'up',
              migrationsTable: 'pgmigrations',
              migrationsSchema: '',
              dryRun,
            })
          ).rejects.toThrow(
            new TypeError(
              'migrationsSchema must be a non-empty string when supplied'
            )
          );
          expect(db.db).not.toHaveBeenCalled();
          expect(query).not.toHaveBeenCalled();
          expect(end).not.toHaveBeenCalled();
        }
      );

      it('preserves missing connection error precedence', async () => {
        await expect(
          // @ts-expect-error: a JavaScript caller can omit the connection
          runner({
            dir: 'test/migrations',
            direction: 'up',
            migrationsTable: 'pgmigrations',
            migrationsSchema: '',
          })
        ).rejects.toThrow(
          'You must provide either a databaseUrl or a dbClient'
        );
        expect(db.db).not.toHaveBeenCalled();
      });

      it('preserves migrations table error precedence', async () => {
        await expect(
          runner({
            databaseUrl: 'postgres://localhost/unused',
            dir: 'test/migrations',
            direction: 'up',
            migrationsTable: '',
            migrationsSchema: '',
          })
        ).rejects.toThrow(
          new TypeError('migrationsTable must be a non-empty string')
        );
        expect(db.db).not.toHaveBeenCalled();
      });
    });

    it.each([
      [undefined, undefined, 'public', '"public"'],
      [undefined, 'app', 'app', '"app"'],
      ['history', 'app', 'history', '"history"'],
      [' ', undefined, ' ', '" "'],
      ['hi"story', undefined, 'hi"story', '"hi""story"'],
    ])(
      'preserves the schema %j with application schema %j',
      async (migrationsSchema, schema, expected, quoted) => {
        const query = vi.fn().mockResolvedValue({ rows: [] });
        const dbClient = { query } as unknown as ClientBase;
        await expect(
          runner({
            dbClient,
            dir: 'test/dry-run-migrations',
            direction: 'up',
            migrationsTable: 'pgmigrations',
            migrationsSchema,
            schema,
            noLock: true,
            fake: true,
            logger: {
              info: vi.fn<LogFn>(),
              warn: vi.fn<LogFn>(),
              error: vi.fn<LogFn>(),
            },
          })
        ).resolves.toHaveLength(1);
        expect(query).toHaveBeenCalledWith(MIGRATIONS_TABLE_EXISTS, [
          'pgmigrations',
          expected,
        ]);
        expect(query).toHaveBeenCalledWith(
          `CREATE TABLE ${quoted}."pgmigrations" (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)`,
          undefined
        );
      }
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

    it('should report the refusal over migration files that fail to load', async () => {
      const { dbClient } = createDbClient({ app: history });
      // A slow database, so the migration files fail to load before the refusal is known.
      const slowClient = {
        query: async (query: string, values?: unknown[]) => {
          await sleep(20);
          return dbClient.query(query, values);
        },
      } as unknown as ClientBase;

      await expect(
        run(slowClient, { dir: 'test/does-not-exist' })
      ).rejects.toThrow('Refusing to run');
    });

    it('should report migration files that fail to load when the history is in place', async () => {
      const { dbClient } = createDbClient();

      await expect(
        run(dbClient, { dir: 'test/does-not-exist' })
      ).rejects.toThrow('Error loading migration files');
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
