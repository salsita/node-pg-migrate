import type { ClientBase } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMigrationStatus } from '../src';
import * as db from '../src/db';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function setup(runNames: string[] = [], hasTable = true) {
  const connection = {
    createConnection: vi.fn().mockResolvedValue(undefined),
    connected: vi.fn(() => true),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    select: vi.fn<db.DBConnection['select']>((query) => {
      const sql = typeof query === 'string' ? query : query.text;
      return Promise.resolve(
        sql.startsWith('SELECT name, run_on')
          ? runNames.map((name) => ({ name }))
          : hasTable
            ? [{}]
            : []
      );
    }),
    column: vi.fn().mockResolvedValue(runNames),
    addBeforeCloseListener: vi.fn(),
  };
  vi.spyOn(db, 'db').mockReturnValue(connection);
  const up = vi.fn();
  const down = vi.fn();
  const options = {
    databaseUrl: 'postgres://localhost/status',
    migrationsTable: 'history',
    migrationsSchema: 'meta',
    migrations: {
      '002_second.ts': { up, down },
      '001_first.ts': { up, down },
    },
    logger,
  };
  return { connection, options, up, down };
}

afterEach(() => vi.restoreAllMocks());

describe('getMigrationStatus', () => {
  it('returns recorded dates for applied and missing entries, with none on pending entries', async () => {
    const { connection, options } = setup(['003_removed', '002_second']);
    const runOn = new Date('2026-10-14T12:00:00.000Z');
    connection.select.mockResolvedValueOnce([{}]).mockResolvedValueOnce([
      { name: '003_removed', runOn },
      { name: '002_second', runOn },
    ]);

    await expect(getMigrationStatus(options)).resolves.toEqual([
      { name: '003_removed', status: 'missing', runOn },
      { name: '002_second', status: 'applied', runOn },
      { name: '001_first', status: 'pending' },
    ]);
    expect(connection.column).not.toHaveBeenCalled();
  });

  it('lists applied and missing migrations in history order, followed by pending migrations', async () => {
    const { connection, options, up, down } = setup([
      '003_removed',
      '002_second',
    ]);

    await expect(getMigrationStatus(options)).resolves.toEqual([
      { name: '003_removed', status: 'missing' },
      { name: '002_second', status: 'applied' },
      { name: '001_first', status: 'pending' },
    ]);
    expect(up).not.toHaveBeenCalled();
    expect(down).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'lists pending migrations when history is empty (table exists: %s)',
    async (hasTable) => {
      const { connection, options } = setup([], hasTable);
      await expect(getMigrationStatus(options)).resolves.toEqual([
        { name: '001_first', status: 'pending' },
        { name: '002_second', status: 'pending' },
      ]);
      expect(connection.select).toHaveBeenCalledTimes(hasTable ? 2 : 1);
      expect(connection.column).not.toHaveBeenCalled();
      expect(connection.query).not.toHaveBeenCalled();
    }
  );

  it('returns an empty list for an empty source and history', async () => {
    const { options } = setup();
    await expect(
      getMigrationStatus({ ...options, migrations: {} })
    ).resolves.toEqual([]);
  });

  it('loads factories but never calls their migration actions', async () => {
    const { options, up } = setup();
    const factory = vi.fn(() => Promise.resolve({ default: { up } }));
    await expect(
      getMigrationStatus({ ...options, migrations: { '001_lazy.ts': factory } })
    ).resolves.toEqual([{ name: '001_lazy', status: 'pending' }]);
    expect(factory).toHaveBeenCalledOnce();
    expect(up).not.toHaveBeenCalled();
  });

  it('uses quoted history names without changing the session or repairing the table', async () => {
    const { connection, options } = setup(['001_first']);
    await getMigrationStatus({
      ...options,
      migrationsSchema: 'a"b',
      migrationsTable: 'c"d',
    });
    expect(connection.select).toHaveBeenCalledWith(expect.any(String), [
      'c"d',
      'a"b',
    ]);
    expect(connection.select).toHaveBeenCalledWith(
      'SELECT name, run_on AS "runOn" FROM "a""b"."c""d" ORDER BY run_on, id'
    );
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('preserves the history-location guard', async () => {
    const { connection, options } = setup([], false);
    connection.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ schema: 'other', readable: false }]);
    await expect(
      getMigrationStatus({ ...options, migrationsSchema: undefined })
    ).rejects.toThrow('exists and cannot be read by this role');
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'explains a status refusal without suggesting it would apply migrations (readable: %s)',
    async (readable) => {
      const { connection, options } = setup([], false);
      connection.select
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ schema: 'other', readable }])
        .mockResolvedValueOnce([{}]);
      const result = getMigrationStatus({
        ...options,
        migrationsSchema: undefined,
      });
      await expect(result).rejects.toThrow(/^Cannot determine status:/);
      await expect(result).rejects.toThrow('--migrations-schema other');
      await expect(result).rejects.not.toThrow('could apply migrations');
    }
  );

  it.each(['history', 'loader'])(
    'closes the connection after a %s failure',
    async (failure) => {
      const { connection, options } = setup();
      const error = new Error('cannot inspect');
      if (failure === 'history') {
        connection.select
          .mockResolvedValueOnce([{}])
          .mockRejectedValueOnce(error);
      }
      const migrations =
        failure === 'loader'
          ? { '001_failure.ts': () => Promise.reject(error) }
          : options.migrations;
      await expect(
        getMigrationStatus({ ...options, migrations })
      ).rejects.toThrow('cannot inspect');
      expect(connection.query).not.toHaveBeenCalled();
      expect(connection.close).toHaveBeenCalledOnce();
    }
  );

  it('does not close a connection that failed to open', async () => {
    const { connection, options } = setup();
    connection.connected.mockReturnValue(false);
    connection.createConnection.mockRejectedValueOnce(new Error('offline'));
    await expect(getMigrationStatus(options)).rejects.toThrow('offline');
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('accepts a caller-owned client and validates before connecting', async () => {
    const { connection, options } = setup();
    const dbClient = {} as ClientBase;
    const { databaseUrl: _databaseUrl, ...rest } = options;
    await getMigrationStatus({ ...rest, dbClient });
    expect(db.db).toHaveBeenCalledWith(dbClient, expect.any(Object));
    connection.createConnection.mockClear();
    await expect(
      getMigrationStatus({ ...rest, dbClient, migrationsTable: '' })
    ).rejects.toThrow('migrationsTable must be a non-empty string');
    expect(connection.createConnection).not.toHaveBeenCalled();
  });
});
