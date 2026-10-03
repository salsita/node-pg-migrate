import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { baseline, runner } from '../../../src';
import { generateBaselineFromCatalogs } from '../../../src/baseline/catalogs';
import type { LogFn, Logger } from '../../../src/logger';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';

// The TypeScript/JavaScript baseline must not depend on the session that reads
// the catalogs: `pg_get_expr()`, `pg_get_constraintdef()` and the partition
// bounds write every constant with the type's output function, so a
// `timestamptz` renders in the session's `TimeZone`, a `date` in its
// `DateStyle`, an `interval` in its `IntervalStyle`, a `float8` with its
// `extra_float_digits` and a `bytea` in its `bytea_output`. Two people of two
// time zones must still get the same file out of the same database.

/**
 * A logger that keeps the output of the specs clean.
 */
function silentLogger(): Logger {
  return {
    debug: vi.fn<LogFn>(),
    info: vi.fn<LogFn>(),
    warn: vi.fn<LogFn>(),
    error: vi.fn<LogFn>(),
  };
}

/**
 * Creates a temporary directory that is removed when the current test
 * finishes.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-session-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * A schema whose every rendered expression depends on a rendering setting of
 * the session: the bound of a `timestamptz` partition and a CHECK on one
 * (`TimeZone`), a `date` default (`DateStyle`), an `interval` default
 * (`IntervalStyle`), a `float8` default that needs 17 digits to round-trip
 * (`extra_float_digits`) and a `bytea` default (`bytea_output`).
 */
const RENDERED_EXPRESSIONS = `
CREATE TABLE public.readings (
    id bigint NOT NULL,
    at timestamp with time zone NOT NULL,
    recorded_at timestamp with time zone DEFAULT '2022-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    span interval DEFAULT '1 day 02:03:04'::interval NOT NULL,
    ratio double precision DEFAULT '0.30000000000000004'::double precision NOT NULL,
    on_day date DEFAULT '2022-02-03'::date NOT NULL,
    token bytea DEFAULT '\\x0102ff'::bytea NOT NULL,
    CONSTRAINT readings_after_launch CHECK ((at > '2021-07-08 09:10:11+00'::timestamp with time zone))
) PARTITION BY RANGE (at);
CREATE TABLE public.readings_2022 PARTITION OF public.readings
    FOR VALUES FROM ('2022-01-01 00:00:00+00') TO ('2023-01-01 00:00:00+00');
`;

/**
 * `SET` statements that move every rendering setting away from the one the
 * migration must be written with: a reader in America/Sao_Paulo with German
 * dates, SQL-standard intervals, no extra float digits and escaped bytes.
 */
const OTHER_SESSION: ReadonlyArray<string> = [
  "SET TimeZone = 'America/Sao_Paulo'",
  "SET DateStyle = 'German, DMY'",
  "SET IntervalStyle = 'sql_standard'",
  'SET extra_float_digits = 0',
  "SET bytea_output = 'escape'",
];

/**
 * The rendering settings this spec pins, as `pg_settings` names them.
 */
const RENDERING_SETTINGS: ReadonlyArray<string> = [
  'TimeZone',
  'DateStyle',
  'IntervalStyle',
  'extra_float_digits',
  'bytea_output',
];

/**
 * What the UTC rendering of {@link RENDERED_EXPRESSIONS} must write, whatever
 * the session: the ISO timestamps of the partition bound and of the CHECK, the
 * `postgres` interval, the exact `float8` and the ISO date. The migration is a
 * TypeScript file, so it escapes the quotes of a constant (`\'…\'`).
 */
const UTC_RENDERINGS: ReadonlyArray<string> = [
  String.raw`\'2022-01-01 00:00:00+00\'`,
  String.raw`\'2023-01-01 00:00:00+00\'`,
  String.raw`\'2021-07-08 09:10:11+00\'`,
  String.raw`\'1 day 02:03:04\'`,
  String.raw`\'0.30000000000000004\'`,
  String.raw`\'2022-02-03\'`,
];

/**
 * What a reader in America/Sao_Paulo with German dates, SQL-standard intervals
 * and `extra_float_digits = 0` would write instead.
 */
const OTHER_RENDERINGS: ReadonlyArray<string> = [
  String.raw`\'31.12.2021 21:00:00 -03\'`,
  String.raw`\'31.12.2022 21:00:00 -03\'`,
  String.raw`\'08.07.2021 06:10:11 -03\'`,
  String.raw`\'1 2:03:04\'`,
  String.raw`\'0.3\'`,
  String.raw`\'03.02.2022\'`,
];

describe.each(PG_VERSIONS)(
  'baseline --format ts|js, rendering settings (PG %s)',
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;
    let databaseCount = 0;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    /**
     * Creates a database with a name no other test uses, with a schema.
     */
    async function databaseWith(sql: string): Promise<string> {
      databaseCount += 1;
      const name = `session_${databaseCount}`;
      await createDatabase(container, name);
      if (sql !== '') {
        await loadSql(container, name, sql);
      }

      return name;
    }

    /**
     * Connects to a database and runs `settings` on the session. The client is
     * closed when the current test finishes.
     */
    async function clientWith(
      database: string,
      settings: ReadonlyArray<string>
    ): Promise<pg.Client> {
      const client = new pg.Client(databaseUrl(container, database));
      await client.connect();
      onTestFinished(async () => {
        await client.end();
      });
      for (const setting of settings) {
        await client.query(setting);
      }

      return client;
    }

    /**
     * The session's value of each of {@link RENDERING_SETTINGS}.
     */
    async function settingsOf(
      client: pg.Client
    ): Promise<Record<string, string>> {
      const { rows } = await client.query<{ name: string; setting: string }>(
        'SELECT name, setting FROM pg_catalog.pg_settings WHERE name = ANY($1)',
        [[...RENDERING_SETTINGS]]
      );

      return Object.fromEntries(
        rows.map(({ name, setting }) => [name, setting])
      );
    }

    it(
      'generates the same migration whatever the rendering settings of the session, in UTC and ISO',
      async () => {
        const database = await databaseWith(RENDERED_EXPRESSIONS);
        const options = { format: 'ts', migrationName: 'b' } as const;

        const defaults = await generateBaselineFromCatalogs(
          await clientWith(database, []),
          options
        );
        const other = await generateBaselineFromCatalogs(
          await clientWith(database, OTHER_SESSION),
          options
        );

        expect(other.content).toBe(defaults.content);
        for (const rendering of UTC_RENDERINGS) {
          expect(defaults.content).toContain(rendering);
        }
        for (const rendering of OTHER_RENDERINGS) {
          expect(defaults.content).not.toContain(rendering);
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'leaves the rendering settings of the caller’s session as they were',
      async () => {
        const database = await databaseWith(RENDERED_EXPRESSIONS);
        const client = await clientWith(database, OTHER_SESSION);
        const before = await settingsOf(client);

        await generateBaselineFromCatalogs(client, {
          format: 'ts',
          migrationName: 'b',
        });

        expect(await settingsOf(client)).toStrictEqual(before);
        expect(before).toStrictEqual({
          TimeZone: 'America/Sao_Paulo',
          DateStyle: 'German, DMY',
          IntervalStyle: 'sql_standard',
          extra_float_digits: '0',
          bytea_output: 'escape',
        });
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds the schema from a baseline read in another time zone',
      async () => {
        const source = await databaseWith(RENDERED_EXPRESSIONS);
        const dir = join(await tempDir(), 'migrations');
        await baseline({
          dbClient: await clientWith(source, OTHER_SESSION),
          dir,
          format: 'ts',
          logger: silentLogger(),
        });

        const blank = await databaseWith('');
        await runner({
          databaseUrl: databaseUrl(container, blank),
          dir,
          direction: 'up',
          migrationsTable: 'pgmigrations',
          logger: silentLogger(),
        });

        expect(await dumpSchema(container, blank)).toBe(
          await dumpSchema(container, source)
        );
      },
      INTEGRATION_TIMEOUT
    );
  }
);
