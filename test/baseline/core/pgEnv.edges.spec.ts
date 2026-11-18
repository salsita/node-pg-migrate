import { describe, expect, it, vi } from 'vitest';
import { toPgEnv } from '../../../src/baseline/core/pgEnv';
import { BaselineError } from '../../../src/baseline/errors';
import { messageOf, rejectionOf } from '../helpers';

describe('toPgEnv', () => {
  describe('connection strings', () => {
    it.each([
      {
        name: 'query parameters over the other parts, like node-postgres',
        connection:
          'postgres://u:p@db:5432/app?host=%2Ftmp&port=6000&user=v&password=w',
        expected: {
          PGHOST: '/tmp',
          PGPORT: '6000',
          PGUSER: 'v',
          PGPASSWORD: 'w',
          PGDATABASE: 'app',
        },
      },
      {
        name: 'an IPv6 host without its brackets',
        connection: 'postgres://u@[::1]:5433/app',
        expected: {
          PGHOST: '::1',
          PGPORT: '5433',
          PGUSER: 'u',
          PGDATABASE: 'app',
        },
      },
      {
        name: 'a password that is not valid percent-encoding as it is',
        connection: 'postgres://u:50%off@db/app',
        expected: {
          PGHOST: 'db',
          PGUSER: 'u',
          PGPASSWORD: '50%off',
          PGDATABASE: 'app',
        },
      },
      {
        name: 'an encoded slash in the database name, as node-postgres keeps it',
        connection: 'postgres://db/my%2Fdb',
        expected: { PGHOST: 'db', PGDATABASE: 'my%2Fdb' },
      },
      {
        name: 'a URL without a host, whose socket is a query parameter',
        connection: 'postgres:///app?host=/var/run/postgresql',
        expected: { PGHOST: '/var/run/postgresql', PGDATABASE: 'app' },
      },
      {
        name: 'a socket directory and a database',
        connection: '/var/run/postgresql app',
        expected: { PGHOST: '/var/run/postgresql', PGDATABASE: 'app' },
      },
      {
        name: 'a socket directory alone',
        connection: '/var/run/postgresql',
        expected: { PGHOST: '/var/run/postgresql' },
      },
      {
        name: 'a socket URL',
        connection: 'socket:/var/run/postgresql?db=app&sslmode=disable',
        expected: {
          PGHOST: '/var/run/postgresql',
          PGDATABASE: 'app',
          PGSSLMODE: 'disable',
        },
      },
      {
        name: "node-postgres' sslmode=no-verify, which is libpq's require",
        connection: 'postgres://db/app?sslmode=no-verify',
        expected: { PGHOST: 'db', PGDATABASE: 'app', PGSSLMODE: 'require' },
      },
    ])('reads $name', async ({ connection, expected }) => {
      await expect(toPgEnv(connection)).resolves.toStrictEqual(expected);
    });

    it.each([
      'postgres://app:s3cret@db:port/app',
      'postgres://app:s3cret@[::1/app',
    ])(
      'refuses %j, which is not a URL, without quoting it',
      async (connection) => {
        const error = await rejectionOf(toPgEnv(connection));

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
        expect(messageOf(error)).not.toContain('s3cret');
      }
    );
  });

  describe('client configs', () => {
    it('takes the connection string over the other fields, like node-postgres', async () => {
      const password = vi.fn(() => 'from-the-function');

      await expect(
        toPgEnv({
          connectionString: 'postgres://app:pw@db:6000/appdb?sslmode=verify-ca',
          host: 'other',
          port: 7000,
          user: 'other',
          password,
          database: 'other',
          ssl: { rejectUnauthorized: false },
        })
      ).resolves.toStrictEqual({
        PGHOST: 'db',
        PGPORT: '6000',
        PGUSER: 'app',
        PGPASSWORD: 'pw',
        PGDATABASE: 'appdb',
        PGSSLMODE: 'verify-ca',
      });
      expect(password).not.toHaveBeenCalled();
    });

    it('fills in what the connection string leaves out from the other fields', async () => {
      await expect(
        toPgEnv({
          connectionString: 'postgres:///appdb',
          host: 'db',
          port: 7000,
          user: 'app',
          password: async (): Promise<string> => {
            await Promise.resolve();

            return 'pw';
          },
        })
      ).resolves.toStrictEqual({
        PGHOST: 'db',
        PGPORT: '7000',
        PGUSER: 'app',
        PGPASSWORD: 'pw',
        PGDATABASE: 'appdb',
      });
    });

    it('leaves out empty values', async () => {
      await expect(
        toPgEnv({ host: '', user: '', database: 'appdb', password: () => '' })
      ).resolves.toStrictEqual({ PGDATABASE: 'appdb' });
    });
  });
});
