import type { ClientConfig } from 'pg';
import { describe, expect, it } from 'vitest';
import { toPgEnv } from '../../../src/baseline/core/pgEnv';

/**
 * The libpq variables `toPgEnv` may set.
 */
const LIBPQ_VARIABLES = new Set([
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'PGSSLMODE',
]);

describe('toPgEnv', () => {
  it('maps a connection URL to the libpq variables', async () => {
    await expect(
      toPgEnv('postgres://ubuntu:s3cret@db.example.com:6543/app_db')
    ).resolves.toStrictEqual({
      PGHOST: 'db.example.com',
      PGPORT: '6543',
      PGUSER: 'ubuntu',
      PGPASSWORD: 's3cret',
      PGDATABASE: 'app_db',
    });
  });

  it('decodes the parts of a URL', async () => {
    await expect(
      toPgEnv('postgresql://us%40er:p%40ss%3Aw%2Frd%20x@localhost:5432/my%20db')
    ).resolves.toStrictEqual({
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'us@er',
      PGPASSWORD: 'p@ss:w/rd x',
      PGDATABASE: 'my db',
    });
  });

  it('decodes a socket directory given as the host of a URL', async () => {
    const env = await toPgEnv(
      'postgres://ubuntu@%2Fvar%2Frun%2Fpostgresql/app'
    );

    expect(env).toMatchObject({
      PGHOST: '/var/run/postgresql',
      PGUSER: 'ubuntu',
      PGDATABASE: 'app',
    });
    expect([undefined, '5432']).toContain(env.PGPORT);
  });

  it.each([
    'disable',
    'allow',
    'prefer',
    'require',
    'verify-ca',
    'verify-full',
  ])('passes sslmode=%s through as PGSSLMODE', async (sslmode) => {
    await expect(
      toPgEnv(`postgres://u:p@db:5432/app?sslmode=${sslmode}`)
    ).resolves.toMatchObject({ PGSSLMODE: sslmode });
  });

  it('maps a client config to the libpq variables', async () => {
    await expect(
      toPgEnv({
        host: 'db.internal',
        port: 5433,
        user: 'app',
        password: 'pw',
        database: 'appdb',
      })
    ).resolves.toStrictEqual({
      PGHOST: 'db.internal',
      PGPORT: '5433',
      PGUSER: 'app',
      PGPASSWORD: 'pw',
      PGDATABASE: 'appdb',
    });
  });

  it('maps a partial client config without empty or undefined values', async () => {
    const env = await toPgEnv({ database: 'appdb' });

    expect(env.PGDATABASE).toBe('appdb');
    expect(
      Object.entries(env).filter(
        ([, value]) =>
          typeof value !== 'string' ||
          value === '' ||
          value === 'undefined' ||
          value === 'null'
      )
    ).toEqual([]);
  });

  it.each([
    {
      name: 'a function',
      password: (): string => 'from-a-function',
      expected: 'from-a-function',
    },
    {
      name: 'an async function',
      password: async (): Promise<string> => {
        await Promise.resolve();

        return 'from-an-async-function';
      },
      expected: 'from-an-async-function',
    },
  ])('calls a password that is $name', async ({ password, expected }) => {
    await expect(
      toPgEnv({ host: 'db', user: 'app', database: 'appdb', password })
    ).resolves.toMatchObject({ PGPASSWORD: expected });
  });

  it('reads the connection string of a client config', async () => {
    await expect(
      toPgEnv({ connectionString: 'postgres://app:pw@db:6000/appdb' })
    ).resolves.toMatchObject({
      PGHOST: 'db',
      PGPORT: '6000',
      PGUSER: 'app',
      PGPASSWORD: 'pw',
      PGDATABASE: 'appdb',
    });
  });

  it.each([
    { name: 'true', ssl: true, expected: 'verify-full' },
    { name: 'an empty object', ssl: {}, expected: 'verify-full' },
    {
      name: 'rejectUnauthorized: true',
      ssl: { rejectUnauthorized: true },
      expected: 'verify-full',
    },
    {
      name: 'rejectUnauthorized: false',
      ssl: { rejectUnauthorized: false },
      expected: 'require',
    },
  ])('maps ssl $name to PGSSLMODE $expected', async ({ ssl, expected }) => {
    await expect(
      toPgEnv({ host: 'db', database: 'appdb', ssl })
    ).resolves.toMatchObject({ PGSSLMODE: expected });
    await expect(
      toPgEnv({ connectionString: 'postgres://app:pw@db:5432/appdb', ssl })
    ).resolves.toMatchObject({ PGSSLMODE: expected });
  });

  it.each([
    { name: 'ssl: false', config: { host: 'db', ssl: false } },
    { name: 'no ssl', config: { host: 'db' } },
  ])('sets no PGSSLMODE with $name', async ({ config }) => {
    await expect(toPgEnv(config)).resolves.not.toHaveProperty('PGSSLMODE');
  });

  it.each<string | ClientConfig>([
    'postgres://app:Sup3r%3AS3cret%40Pass@db.example.com:5432/appdb?sslmode=require',
    {
      host: 'db.example.com',
      port: 5432,
      user: 'app',
      password: 'Sup3r:S3cret@Pass',
      database: 'appdb',
      ssl: { rejectUnauthorized: false },
    },
    {
      connectionString:
        'postgres://app:Sup3r%3AS3cret%40Pass@db.example.com:5432/appdb',
    },
  ])(
    'only sets libpq variables, and the password only in PGPASSWORD (%j)',
    async (connection) => {
      const env = await toPgEnv(connection);

      expect(
        Object.keys(env).filter((key) => !LIBPQ_VARIABLES.has(key))
      ).toEqual([]);
      expect(env.PGPASSWORD).toBe('Sup3r:S3cret@Pass');
      expect(
        Object.entries(env).filter(
          ([key, value]) =>
            key !== 'PGPASSWORD' &&
            (value.includes('S3cret') || value.includes('://'))
        )
      ).toEqual([]);
      expect(
        Object.values(env).every((value) => typeof value === 'string')
      ).toBe(true);
    }
  );
});
