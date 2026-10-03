import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClientBase } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runner } from '../src/runner';
import type { RunnerOptionConfig } from '../src/runner';
import { escapeValue } from '../src/utils';

const FIRST = '001_first';
const SECOND = '002_second';
const THIRD = '003_third';
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

function migrationSource(name: string): string {
  return `exports.up = (pgm) => pgm.sql("SELECT 'up ${name}'");
exports.down = (pgm) => pgm.sql("SELECT 'down ${name}'");
`;
}

interface SetupOptions {
  history?: string[];
  files?: Record<string, string>;
  failedSql?: string;
  rollbackError?: unknown;
  onQuery?: (sql: string, dir: string) => Promise<void>;
}

async function setup({
  history: initialHistory = [FIRST, SECOND],
  files = {
    [FIRST]: migrationSource(FIRST),
    [SECOND]: migrationSource(SECOND),
  },
  failedSql,
  rollbackError,
  onQuery,
}: SetupOptions = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'npm-redo-test-'));
  tempDirs.push(dir);
  await Promise.all(
    Object.entries(files).map(([name, source]) =>
      writeFile(join(dir, `${name}.cjs`), source)
    )
  );

  const history = [...initialHistory];
  let transactionHistory: string[] | undefined;
  const error = new Error('migration failed');
  const rejectRollback = vi.fn().mockRejectedValue(rollbackError);
  const query = vi.fn(async (sql: string) => {
    if (failedSql !== undefined && sql.startsWith(failedSql)) {
      throw error;
    }
    if (sql === 'ROLLBACK' && rollbackError !== undefined) {
      return rejectRollback();
    }
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ lockObtained: true }] };
    }
    if (sql.includes('pg_advisory_unlock')) {
      return { rows: [{ lockReleased: true }] };
    }
    if (sql.includes('has_schema_privilege')) {
      return { rows: [] };
    }
    if (sql.startsWith('SELECT 1 FROM pg_catalog.')) {
      return { rows: [{}] };
    }
    if (sql.startsWith('SELECT name FROM')) {
      return { rows: history.map((name) => ({ name })) };
    }

    switch (sql.replace(/;$/, '')) {
      case 'BEGIN': {
        transactionHistory = [...history];
        break;
      }
      case 'COMMIT': {
        transactionHistory = undefined;
        break;
      }
      case 'ROLLBACK': {
        if (transactionHistory !== undefined) {
          history.splice(0, history.length, ...transactionHistory);
          transactionHistory = undefined;
        }
        break;
      }
      default: {
        const deleted = /^DELETE FROM .* WHERE name=(\$[a-z]+\$)(.*?)\1;$/.exec(
          sql
        );
        const inserted =
          /^INSERT INTO .* VALUES \((\$[a-z]+\$)(.*?)\1, NOW\(\)\);$/.exec(sql);
        if (deleted !== null) {
          const index = history.indexOf(deleted[2]);
          if (index !== -1) {
            history.splice(index, 1);
          }
        } else if (inserted !== null) {
          history.push(inserted[2]);
        }
      }
    }

    await onQuery?.(sql, dir);
    return { rows: [] };
  });
  const end = vi.fn();
  const dbClient = { query, end } as unknown as ClientBase;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const run = (options: Partial<RunnerOptionConfig> = {}) =>
    runner({
      dbClient,
      logger,
      dir,
      migrationsTable: 'pgmigrations',
      direction: 'redo',
      singleTransaction: true,
      ...options,
    });
  const statements = () => query.mock.calls.map(([sql]) => sql);
  const actions = () =>
    statements().filter((sql) => /^SELECT '(up|down) /.test(sql));
  const transactions = () =>
    statements().filter((sql) => /^(BEGIN|COMMIT|ROLLBACK);?$/.test(sql));

  return {
    run,
    query,
    history,
    logger,
    error,
    end,
    statements,
    actions,
    transactions,
  };
}

describe('redo', () => {
  it('reverts in reverse order and reapplies in forward order in one transaction', async () => {
    const { run, query, history, end, actions, transactions } = await setup();

    const result = await run({ count: 2 });

    expect(actions()).toEqual([
      `SELECT 'down ${SECOND}';`,
      `SELECT 'down ${FIRST}';`,
      `SELECT 'up ${FIRST}';`,
      `SELECT 'up ${SECOND}';`,
    ]);
    expect(transactions()).toEqual(['BEGIN', 'COMMIT']);
    expect(history).toEqual([FIRST, SECOND]);
    expect(result.map(({ name }) => name)).toEqual([
      SECOND,
      FIRST,
      FIRST,
      SECOND,
    ]);
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('pg_try_advisory_lock'))
    ).toHaveLength(1);
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_unlock'))
    ).toHaveLength(1);
    expect(
      query.mock.calls.filter(([sql]) =>
        sql.startsWith('SELECT 1 FROM pg_catalog.pg_class')
      )
    ).toHaveLength(1);
    expect(end).not.toHaveBeenCalled();
  });

  it.each([false, undefined])(
    'retains per-migration transactions when singleTransaction=%s',
    async (singleTransaction) => {
      const { run, actions, transactions } = await setup();

      await run({ singleTransaction });

      expect(actions()).toEqual([
        `SELECT 'down ${SECOND}';`,
        `SELECT 'up ${SECOND}';`,
      ]);
      expect(transactions()).toEqual([
        'BEGIN;',
        'COMMIT;',
        'BEGIN;',
        'COMMIT;',
      ]);
    }
  );

  it.each([{ count: -1 }, { count: 2, timestamp: true }, { file: SECOND }])(
    'preserves down selection for %j',
    async (options) => {
      const { run, history, actions } = await setup();

      await run(options);

      expect(actions()).toEqual([
        `SELECT 'down ${SECOND}';`,
        `SELECT 'up ${SECOND}';`,
      ]);
      expect(history).toEqual([FIRST, SECOND]);
    }
  );

  it('reapplies all pending migrations after the selected down migrations', async () => {
    const { run, history, actions } = await setup({
      files: {
        [FIRST]: migrationSource(FIRST),
        [SECOND]: migrationSource(SECOND),
        [THIRD]: migrationSource(THIRD),
      },
    });

    await run({ count: 2, timestamp: true });

    expect(actions()).toEqual([
      `SELECT 'down ${SECOND}';`,
      `SELECT 'up ${SECOND}';`,
      `SELECT 'up ${THIRD}';`,
    ]);
    expect(history).toEqual([FIRST, SECOND, THIRD]);
  });

  it('reloads automatically reversed migrations before reapplying them', async () => {
    const { run, history, statements } = await setup({
      history: [FIRST],
      files: {
        [FIRST]:
          "exports.up = (pgm) => pgm.createTable('redo_table', { id: 'integer' });",
      },
    });

    await run();

    const sql = statements();
    expect(
      sql.filter((statement) => /^(DROP|CREATE) TABLE/.test(statement))
    ).toEqual([
      'DROP TABLE "redo_table";',
      'CREATE TABLE "redo_table" ("id" integer);',
    ]);
    expect(
      sql.filter((statement) => /^(DELETE FROM|INSERT INTO)/.test(statement))
    ).toEqual([
      `DELETE FROM "public"."pgmigrations" WHERE name=${escapeValue(FIRST)};`,
      `INSERT INTO "public"."pgmigrations" (name, run_on) VALUES (${escapeValue(FIRST)}, NOW());`,
    ]);
    expect(history).toEqual([FIRST]);
  });

  it.each([undefined, new Error('rollback failed'), 'rollback failed'])(
    'rolls back before unlocking and preserves an up failure (rollback error=%s)',
    async (rollbackError) => {
      const { run, error, history, logger, statements, transactions } =
        await setup({
          failedSql: `SELECT 'up ${SECOND}'`,
          rollbackError,
        });

      await expect(run()).rejects.toBe(error);

      expect(transactions()).toEqual(['BEGIN', 'ROLLBACK']);
      expect(statements().slice(-2)).toEqual([
        'ROLLBACK',
        'SELECT pg_advisory_unlock(7241865325823964) AS "lockReleased"',
      ]);
      expect(history).toEqual(
        rollbackError === undefined ? [FIRST, SECOND] : [FIRST]
      );
      expect(logger.warn.mock.calls).toEqual([
        ['> Rolling back attempted migration ...'],
        ...(rollbackError === undefined ? [] : [['rollback failed']]),
      ]);
    }
  );

  it('does not run up after a down failure', async () => {
    const { run, error, history, actions, transactions } = await setup({
      failedSql: `SELECT 'down ${FIRST}'`,
    });

    await expect(run({ count: 2 })).rejects.toBe(error);

    expect(actions()).toEqual([
      `SELECT 'down ${SECOND}';`,
      `SELECT 'down ${FIRST}';`,
    ]);
    expect(transactions()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(history).toEqual([FIRST, SECOND]);
  });

  it('rolls back down when reloading the migration files fails', async () => {
    const { run, history, transactions, statements } = await setup({
      onQuery: async (sql, dir) => {
        if (sql.startsWith('DELETE FROM')) {
          await rm(dir, { recursive: true, force: true });
        }
      },
    });

    await expect(run()).rejects.toThrow('Error loading migration files:');

    expect(transactions()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(history).toEqual([FIRST, SECOND]);
    expect(statements().at(-1)).toContain('pg_advisory_unlock');
  });

  it('does not roll back a transaction that failed to start', async () => {
    const { run, error, actions, transactions } = await setup({
      failedSql: 'BEGIN',
    });

    await expect(run()).rejects.toBe(error);

    expect(actions()).toEqual([]);
    expect(transactions()).toEqual(['BEGIN']);
  });

  it('returns no migrations when neither phase has migrations to run', async () => {
    const { run, actions, logger } = await setup({ history: [], files: {} });

    await expect(run()).resolves.toEqual([]);

    expect(actions()).toEqual([]);
    expect(logger.info.mock.calls).toEqual([
      ['No migrations to revert!'],
      ['No migrations to run!'],
    ]);
  });

  it.each(['up', 'down'] as const)(
    'retains the empty message for a standalone %s run',
    async (direction) => {
      const { run, logger } = await setup({ history: [], files: {} });

      await expect(run({ direction })).resolves.toEqual([]);

      expect(logger.info).toHaveBeenCalledWith('No migrations to run!');
    }
  );

  it('applies pending migrations when the down phase has nothing to revert', async () => {
    const { run, history, actions, transactions, logger } = await setup({
      history: [],
    });

    await run();

    expect(actions()).toEqual([
      `SELECT 'up ${FIRST}';`,
      `SELECT 'up ${SECOND}';`,
    ]);
    expect(transactions()).toEqual(['BEGIN', 'COMMIT']);
    expect(history).toEqual([FIRST, SECOND]);
    expect(logger.info).toHaveBeenCalledWith('No migrations to revert!');
    expect(logger.info).not.toHaveBeenCalledWith('No migrations to run!');
  });

  it('keeps fake bookkeeping for both phases in one transaction without running migration SQL', async () => {
    const { run, history, actions, transactions, statements } = await setup();

    await run({ fake: true, noLock: true });

    expect(actions()).toEqual([]);
    expect(transactions()).toEqual(['BEGIN', 'COMMIT']);
    expect(history).toEqual([FIRST, SECOND]);
    expect(
      statements().filter((sql) => /^(DELETE FROM|INSERT INTO)/.test(sql))
    ).toHaveLength(2);
    expect(statements().some((sql) => sql.includes('advisory'))).toBe(false);
  });

  it('rolls back fake down bookkeeping if the up insert fails', async () => {
    const { run, error, history, actions, transactions } = await setup({
      failedSql: 'INSERT INTO',
    });

    await expect(run({ fake: true })).rejects.toBe(error);

    expect(actions()).toEqual([]);
    expect(transactions()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(history).toEqual([FIRST, SECOND]);
  });

  it('prints a dry run in a read-only transaction without acquiring a lock or changing history', async () => {
    const { run, history, logger, statements, actions, transactions } =
      await setup();

    const result = await run({ dryRun: true, count: 2 });

    expect(actions()).toEqual([]);
    expect(transactions()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(statements()).toContain('SET TRANSACTION READ ONLY');
    expect(statements().some((sql) => sql.includes('advisory'))).toBe(false);
    expect(
      statements().some((sql) => /^(DELETE FROM|INSERT INTO)/.test(sql))
    ).toBe(false);
    expect(history).toEqual([FIRST, SECOND]);
    expect(
      logger.info.mock.calls
        .map(([message]) => message)
        .join('\n')
        .match(/SELECT '(?:down|up) [^']+';/g)
    ).toEqual([
      `SELECT 'down ${SECOND}';`,
      `SELECT 'down ${FIRST}';`,
      `SELECT 'up ${FIRST}';`,
      `SELECT 'up ${SECOND}';`,
    ]);
    expect(result.map(({ name }) => name)).toEqual([
      SECOND,
      FIRST,
      FIRST,
      SECOND,
    ]);
    expect(
      statements().filter((sql) => sql.startsWith('SELECT name FROM'))
    ).toHaveLength(1);
  });

  it.each([
    {
      options: { count: -1 },
      expected: [
        `SELECT 'down ${SECOND}';`,
        `SELECT 'up ${SECOND}';`,
        `SELECT 'up ${THIRD}';`,
      ],
    },
    {
      options: { count: 2, timestamp: true },
      expected: [
        `SELECT 'down ${SECOND}';`,
        `SELECT 'up ${SECOND}';`,
        `SELECT 'up ${THIRD}';`,
      ],
    },
    {
      options: { file: SECOND },
      expected: [`SELECT 'down ${SECOND}';`, `SELECT 'up ${SECOND}';`],
    },
  ])(
    'prints the selected redo and pending migrations for %j',
    async ({ options, expected }) => {
      const { run, logger, history, statements } = await setup({
        files: {
          [FIRST]: migrationSource(FIRST),
          [SECOND]: migrationSource(SECOND),
          [THIRD]: migrationSource(THIRD),
        },
      });

      await run({ dryRun: true, ...options });

      expect(
        logger.info.mock.calls
          .map(([message]) => message)
          .join('\n')
          .match(/SELECT '(?:down|up) [^']+';/g)
      ).toEqual(expected);
      expect(history).toEqual([FIRST, SECOND]);
      expect(
        statements().filter((sql) => sql.startsWith('SELECT name FROM'))
      ).toHaveLength(1);
      expect(
        statements().some((sql) => /^(DELETE FROM|INSERT INTO)/.test(sql))
      ).toBe(false);
    }
  );

  it('prints both fake dry-run bookkeeping phases without executing or rereading history', async () => {
    const { run, logger, history, statements, actions } = await setup();

    await run({ dryRun: true, fake: true, count: 2 });

    expect(
      logger.info.mock.calls
        .flatMap(([message]) => message.split('\n'))
        .filter((sql) => /^(DELETE FROM|INSERT INTO)/.test(sql))
    ).toEqual([
      `DELETE FROM "public"."pgmigrations" WHERE name=${escapeValue(SECOND)};`,
      `DELETE FROM "public"."pgmigrations" WHERE name=${escapeValue(FIRST)};`,
      `INSERT INTO "public"."pgmigrations" (name, run_on) VALUES (${escapeValue(FIRST)}, NOW());`,
      `INSERT INTO "public"."pgmigrations" (name, run_on) VALUES (${escapeValue(SECOND)}, NOW());`,
    ]);
    expect(actions()).toEqual([]);
    expect(
      statements().some((sql) => /^(DELETE FROM|INSERT INTO)/.test(sql))
    ).toBe(false);
    expect(history).toEqual([FIRST, SECOND]);
    expect(
      statements().filter((sql) => sql.startsWith('SELECT name FROM'))
    ).toHaveLength(1);
    expect(statements().some((sql) => sql.includes('advisory'))).toBe(false);
  });

  it('prints a fresh up operation after automatically inferring the dry-run down operation', async () => {
    const { run, logger, history, statements } = await setup({
      history: [FIRST],
      files: {
        [FIRST]:
          "exports.up = (pgm) => pgm.createTable('redo_table', { id: 'integer' });",
      },
    });

    await run({ dryRun: true });

    expect(
      logger.info.mock.calls
        .flatMap(([message]) => message.split('\n'))
        .filter((sql) => /^(DROP|CREATE) TABLE/.test(sql))
    ).toEqual([
      'DROP TABLE "redo_table";',
      'CREATE TABLE "redo_table" ("id" integer);',
    ]);
    expect(history).toEqual([FIRST]);
    expect(statements().some((sql) => /^(DROP|CREATE) TABLE/.test(sql))).toBe(
      false
    );
  });
});
