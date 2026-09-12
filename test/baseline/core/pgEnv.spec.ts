import type { ClientConfig } from 'pg';
import { describe, expect, it } from 'vitest';
import { pgDumpEnv, toPgEnv } from '../../../src/baseline/core/pgEnv';

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
  'PGSSLROOTCERT',
  'PGSSLCERT',
  'PGSSLKEY',
  'PGSSLCRL',
]);

/**
 * A connection string with the certificate files of a verify-full
 * connection, the way RDS, Azure and Cloud SQL document it. The root
 * certificate is percent-encoded.
 */
const SSL_FILES_URL =
  'postgres://u:p@db.example.com:5432/app?sslmode=verify-full&sslrootcert=%2Fetc%2Fssl%2Frds%20ca.pem&sslcert=/home/app/.postgresql/client.crt&sslkey=/home/app/.postgresql/client.key&sslcrl=/etc/ssl/revoked.crl';

/**
 * The startup option pg_dump always gets last in `PGOPTIONS`, so that it
 * writes backslashes in string literals the standard way.
 */
const STANDARD_LITERALS = '-c standard_conforming_strings=on';

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

  it.each<{ name: string; connection: string | ClientConfig }>([
    { name: 'a connection string', connection: SSL_FILES_URL },
    {
      name: 'the connection string of a client config',
      connection: { connectionString: SSL_FILES_URL },
    },
  ])(
    'passes the certificate files of $name as PGSSLROOTCERT, PGSSLCERT, PGSSLKEY and PGSSLCRL',
    async ({ connection }) => {
      await expect(toPgEnv(connection)).resolves.toMatchObject({
        PGSSLMODE: 'verify-full',
        PGSSLROOTCERT: '/etc/ssl/rds ca.pem',
        PGSSLCERT: '/home/app/.postgresql/client.crt',
        PGSSLKEY: '/home/app/.postgresql/client.key',
        PGSSLCRL: '/etc/ssl/revoked.crl',
      });
    }
  );

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

describe('pgDumpEnv', () => {
  it('puts the connection settings over the inherited environment, and keeps the rest of it', () => {
    expect(
      pgDumpEnv(
        {
          PATH: '/usr/bin',
          PGUSER: 'someone-else',
          PGPORT: '6000',
          PGSSLMODE: 'verify-ca',
          PGCONNECT_TIMEOUT: '5',
        },
        {
          PGHOST: 'db.example.com',
          PGUSER: 'app',
          PGPASSWORD: 'pw',
          PGDATABASE: 'appdb',
          PGSSLMODE: 'verify-full',
        }
      )
    ).toStrictEqual({
      PATH: '/usr/bin',
      PGHOST: 'db.example.com',
      PGPORT: '6000',
      PGUSER: 'app',
      PGPASSWORD: 'pw',
      PGDATABASE: 'appdb',
      PGSSLMODE: 'verify-full',
      PGCONNECT_TIMEOUT: '5',
      PGCLIENTENCODING: 'UTF8',
      PGOPTIONS: STANDARD_LITERALS,
    });
  });

  it('leaves the inherited environment as it is', () => {
    const inherited = {
      PGSERVICE: 'reporting',
      PGSERVICEFILE: '/etc/pg_service.conf',
      PGHOSTADDR: '203.0.113.7',
      PGSSLMODE: 'no-verify',
      PGCLIENTENCODING: 'LATIN1',
      PGOPTIONS: '-c TimeZone=UTC',
    };
    const before = { ...inherited };

    pgDumpEnv(inherited, { PGHOST: 'db.example.com' });

    expect(inherited).toStrictEqual(before);
  });

  it.each<{ name: string; connection: Record<string, string> }>([
    {
      name: 'a connection with a host',
      connection: { PGHOST: 'db.example.com', PGDATABASE: 'appdb' },
    },
    {
      name: 'a connection without a host',
      connection: { PGDATABASE: 'appdb' },
    },
  ])(
    'leaves out an inherited PGSERVICE and PGSERVICEFILE for $name',
    ({ connection }) => {
      const env = pgDumpEnv(
        { PGSERVICE: 'reporting', PGSERVICEFILE: '/etc/pg_service.conf' },
        connection
      );

      expect(env).not.toHaveProperty('PGSERVICE');
      expect(env).not.toHaveProperty('PGSERVICEFILE');
      expect(env).toMatchObject(connection);
    }
  );

  it('leaves out an inherited PGHOSTADDR when the connection gives a host', () => {
    const env = pgDumpEnv(
      { PGHOST: 'other.example.com', PGHOSTADDR: '203.0.113.7' },
      { PGHOST: 'db.example.com' }
    );

    expect(env).not.toHaveProperty('PGHOSTADDR');
    expect(env.PGHOST).toBe('db.example.com');
  });

  it('keeps an inherited PGHOSTADDR when the connection gives no host, as it keeps the inherited PGHOST', () => {
    expect(
      pgDumpEnv(
        { PGHOST: 'db.example.com', PGHOSTADDR: '203.0.113.7' },
        { PGDATABASE: 'appdb' }
      )
    ).toMatchObject({
      PGHOST: 'db.example.com',
      PGHOSTADDR: '203.0.113.7',
      PGDATABASE: 'appdb',
    });
  });

  it.each<{
    name: string;
    inherited: NodeJS.ProcessEnv;
    connection: Record<string, string>;
    expected: string;
  }>([
    {
      name: "the user's own PGSSLMODE=no-verify of node-postgres",
      inherited: { PGSSLMODE: 'no-verify' },
      connection: { PGHOST: 'db.example.com' },
      expected: 'require',
    },
    {
      name: 'a PGSSLMODE=no-verify of the connection',
      inherited: {},
      connection: { PGHOST: 'db.example.com', PGSSLMODE: 'no-verify' },
      expected: 'require',
    },
    {
      name: 'the PGSSLMODE of the connection over an inherited no-verify',
      inherited: { PGSSLMODE: 'no-verify' },
      connection: { PGHOST: 'db.example.com', PGSSLMODE: 'verify-full' },
      expected: 'verify-full',
    },
    {
      name: "the user's own PGSSLMODE=verify-ca",
      inherited: { PGSSLMODE: 'verify-ca' },
      connection: { PGHOST: 'db.example.com' },
      expected: 'verify-ca',
    },
  ])(
    'gives pg_dump PGSSLMODE=$expected for $name',
    ({ inherited, connection, expected }) => {
      expect(pgDumpEnv(inherited, connection).PGSSLMODE).toBe(expected);
    }
  );

  it.each([
    { name: 'none', inherited: {} },
    { name: 'UTF8', inherited: { PGCLIENTENCODING: 'UTF8' } },
    { name: 'LATIN1', inherited: { PGCLIENTENCODING: 'LATIN1' } },
  ])(
    'makes pg_dump write UTF-8 when the inherited PGCLIENTENCODING is $name',
    ({ inherited }) => {
      expect(
        pgDumpEnv(inherited, { PGHOST: 'db.example.com' }).PGCLIENTENCODING
      ).toBe('UTF8');
    }
  );

  it.each([
    { name: 'no PGOPTIONS', inherited: {}, expected: STANDARD_LITERALS },
    {
      name: 'an empty PGOPTIONS',
      inherited: { PGOPTIONS: '' },
      expected: STANDARD_LITERALS,
    },
    {
      name: 'PGOPTIONS with other settings',
      inherited: { PGOPTIONS: '-c TimeZone=Asia/Tokyo' },
      expected: `-c TimeZone=Asia/Tokyo ${STANDARD_LITERALS}`,
    },
    {
      name: 'PGOPTIONS that turn standard_conforming_strings off',
      inherited: { PGOPTIONS: '-c standard_conforming_strings=off' },
      expected: `-c standard_conforming_strings=off ${STANDARD_LITERALS}`,
    },
  ])(
    'ends PGOPTIONS with standard_conforming_strings=on, after the inherited options, for $name',
    ({ inherited, expected }) => {
      expect(pgDumpEnv(inherited, { PGHOST: 'db.example.com' }).PGOPTIONS).toBe(
        expected
      );
    }
  );
});
