import type { QueryArrayConfig, QueryConfig } from 'pg';
import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DBConnection } from '../src/db';
import { db as Db } from '../src/db';
import type { LogFn, Logger } from '../src/logger';

type MockClient = {
  connect: (cb: (err?: Error | null) => void) => void;
  end: () => void;
  query: (
    q: string | QueryConfig | QueryArrayConfig,
    values?: unknown[]
  ) => Promise<unknown>;
};

const hoisted: { client: MockClient } = vi.hoisted(() => ({
  client: {
    connect: vi.fn<MockClient['connect']>(),
    end: vi.fn<MockClient['end']>(),
    query: vi.fn<MockClient['query']>(),
  },
}));

vi.mock('pg', () => {
  const client = vi.fn().mockImplementation(
    // this needs to be a function instead of an arrow function
    // see https://vitest.dev/api/vi.html#vi-spyon for more details
    function () {
      return hoisted.client;
    }
  );
  return {
    default: {
      Client: client,
    },
    Client: client,
  };
});

describe('db', () => {
  const log: Logger = {
    debug: vi.fn<LogFn>(),
    error: vi.fn<LogFn>(),
    info: vi.fn<LogFn>(),
    warn: vi.fn<LogFn>(),
  };

  describe('constructor', () => {
    let db: DBConnection;

    afterEach(async () => {
      if (db) {
        await db.close();
      }
    });

    it('should call pg.Client with connection string', () => {
      db = Db('connection_string');

      expect(Client).toHaveBeenCalledWith('connection_string');
    });

    it('should use external client', async () => {
      const mockClient = new Client();
      const mocked = vi.spyOn(mockClient, 'query');

      db = Db(mockClient, log);

      await db.query('query');

      expect(mocked).toHaveBeenCalledExactlyOnceWith('query', undefined);
    });
  });

  describe('query', () => {
    let db: DBConnection;

    beforeEach(() => {
      // @ts-expect-error: JS only test
      db = Db(undefined, log);
    });

    afterEach(async () => {
      await db.close();

      vi.clearAllMocks();
    });

    it('should call client.connect if this is the first query', async () => {
      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) => {
        fn();
      });

      await db.query('query');

      expect(hoisted.client.connect).toHaveBeenCalledOnce();
    });

    it('should not call client.connect on subsequent queries', async () => {
      await db.query('query_one');
      await db.query('query_two');

      expect(hoisted.client.connect).toHaveBeenCalledOnce();
    });

    it('should call client.query with query', async () => {
      await db.query('query');

      expect(hoisted.client.query).toHaveBeenCalledExactlyOnceWith(
        'query',
        undefined
      );
    });

    it('should not call client.query if client.connect fails', async () => {
      const error = 'error';

      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) => {
        fn(new Error(error));
      });

      await expect(() => db.query('query')).rejects.toThrow(error);
      expect(hoisted.client.query).not.toHaveBeenCalled();
    });

    it('should resolve promise if query throws no error', async () => {
      const result = 'result';

      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) => {
        fn();
      });
      vi.spyOn(hoisted.client, 'query').mockResolvedValue(result);

      await expect(db.query('query')).resolves.toBe(result);
    });

    it('should reject promise if query throws error', async () => {
      const error = 'error';

      vi.spyOn(hoisted.client, 'query').mockRejectedValue(new Error(error));

      await expect(() => db.query('query')).rejects.toThrow(error);
      expect(hoisted.client.connect).toHaveBeenCalledOnce();
    });
  });

  describe('query error log', () => {
    let db: DBConnection;

    beforeEach(() => {
      vi.clearAllMocks();

      db = Db(new Client(), log);
    });

    afterEach(async () => {
      await db.close();
    });

    /** Runs `sql` so that it fails with `error`, and returns what was logged. */
    async function loggedError(sql: string, error: Error): Promise<string> {
      vi.spyOn(hoisted.client, 'query').mockRejectedValueOnce(error);

      await expect(db.query(sql)).rejects.toBe(error);
      expect(log.error).toHaveBeenCalledOnce();

      return vi.mocked(log.error).mock.calls[0][0];
    }

    /** An error like pg's, which has the 1-based `position` as a string. */
    function errorAt(message: string, position: number): Error {
      return Object.assign(new Error(message), { position: String(position) });
    }

    /** `SELECT 1;` to `SELECT 10000;`, one statement per line. */
    function longQueryLines(): string[] {
      return Array.from(
        { length: 10_000 },
        (_, index) => `SELECT ${index + 1};`
      );
    }

    describe('contract', () => {
      it('should log a short query in full with a caret under the error', async () => {
        const sql = [
          'CREATE TABLE a (id int);',
          'CREATE TABLE b (id int);',
          'CREATE TABLE c (id int,);',
          'CREATE TABLE d (id int);',
          'CREATE TABLE e (id int);',
        ].join('\n');
        const error = errorAt(
          'syntax error at or near ")"',
          sql.indexOf(',);') + 2
        );

        expect(await loggedError(sql, error)).toBe(
          [
            'Error executing:',
            'CREATE TABLE a (id int);',
            'CREATE TABLE b (id int);',
            'CREATE TABLE c (id int,);',
            `${' '.repeat(23)}^^^^`,
            'CREATE TABLE d (id int);',
            'CREATE TABLE e (id int);',
            '',
            'syntax error at or near ")"',
            '',
          ].join('\n')
        );
      });

      it('should log a short query in full when the error has no position', async () => {
        const lines = [
          'INSERT INTO t VALUES (1);',
          'INSERT INTO t VALUES (2);',
          'INSERT INTO t VALUES (3);',
          'INSERT INTO t VALUES (1);',
          'INSERT INTO t VALUES (5);',
        ];
        const error = new Error(
          'duplicate key value violates unique constraint "t_pkey"'
        );

        expect(await loggedError(lines.join('\n'), error)).toBe(
          [
            'Error executing:',
            ...lines,
            'Error: duplicate key value violates unique constraint "t_pkey"',
            '',
          ].join('\n')
        );
      });
    });

    describe('regressions', () => {
      it('should log only the lines around the error of a long query', async () => {
        const lines = longQueryLines();
        lines[4999] = 'SELECT 5000 FROM;';
        const sql = lines.join('\n');
        const error = errorAt(
          'syntax error at or near ";"',
          sql.indexOf('FROM;') + 5
        );
        const caret = `${' '.repeat(16)}^^^^`;

        const logged = (await loggedError(sql, error)).split('\n');

        expect(logged).toContain('... (4989 lines omitted)');
        expect(logged).not.toContain('SELECT 4989;');
        expect(logged).toContain('SELECT 4990;');
        expect(logged).toContain(caret);
        expect(logged).toContain('SELECT 5010;');
        expect(logged).not.toContain('SELECT 5011;');
        expect(logged).toContain('... (4990 lines omitted)');
        expect(logged).toContain('syntax error at or near ";"');
        expect(logged.length).toBeLessThanOrEqual(30);
        expect(logged).toEqual([
          'Error executing:',
          '... (4989 lines omitted)',
          ...lines.slice(4989, 5000),
          caret,
          ...lines.slice(5000, 5010),
          '... (4990 lines omitted)',
          '',
          'syntax error at or near ";"',
          '',
        ]);
      });

      it('should log only the first lines of a long query when the error has no position', async () => {
        const lines = longQueryLines();
        const error = new Error('canceling statement due to statement timeout');

        const logged = (await loggedError(lines.join('\n'), error)).split('\n');

        expect(logged.slice(1, 22)).toEqual(lines.slice(0, 21));
        expect(logged).not.toContain('SELECT 22;');
        expect(logged).toContain('... (9979 lines omitted)');
        expect(logged).toContain(
          'Error: canceling statement due to statement timeout'
        );
        expect(logged).toEqual([
          'Error executing:',
          ...lines.slice(0, 21),
          '... (9979 lines omitted)',
          'Error: canceling statement due to statement timeout',
          '',
        ]);
      });
    });
  });

  describe('close', () => {
    it('should call client.end', async () => {
      // @ts-expect-error: JS only test
      const db = Db();

      await db.close();

      expect(hoisted.client.end).toHaveBeenCalled();
    });
  });

  describe('connected', () => {
    it('should treat external connection as conencted', () => {
      const mockClient = new Client();
      const db = Db(mockClient, log);
      expect(db.connected()).toBeTruthy();
    });
  });
});
