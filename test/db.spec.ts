import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DBConnection } from '../src/db';
import { db as Db } from '../src/db';
import type { Logger } from '../src/logger';

const hoisted = vi.hoisted(() => ({
  client: {
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('pg', () => {
  const client = vi.fn().mockImplementation(() => hoisted.client);
  return {
    default: {
      Client: client,
    },
    Client: client,
  };
});

describe('db', () => {
  const log: Logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  describe('constructor', () => {
    let db: DBConnection;

    afterEach(() => {
      if (db) {
        db.close();
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

      expect(mocked).toHaveBeenCalledOnce();
      expect(mocked).toHaveBeenCalledWith('query', undefined);
    });
  });

  describe('query', () => {
    let db: DBConnection;

    beforeEach(() => {
      // @ts-expect-error: JS only test
      db = Db(undefined, log);
    });

    afterEach(() => {
      db.close();

      vi.clearAllMocks();
    });

    it('should call client.connect if this is the first query', async () => {
      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) => fn());

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

      expect(hoisted.client.query).toHaveBeenCalledOnce();
      expect(hoisted.client.query).toHaveBeenCalledWith('query', undefined);
    });

    it('should not call client.query if client.connect fails', async () => {
      const error = 'error';

      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) =>
        fn(new Error(error))
      );

      await expect(() => db.query('query')).rejects.toThrow(error);
      expect(hoisted.client.query).not.toHaveBeenCalled();
    });

    it('should resolve promise if query throws no error', async () => {
      const result = 'result';

      vi.spyOn(hoisted.client, 'connect').mockImplementation((fn) => fn());
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
