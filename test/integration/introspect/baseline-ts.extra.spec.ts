import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import type { Mock } from 'vitest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { baseline, BaselineError, runner } from '../../../src';
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

// `baseline({ format: 'ts' | 'js' })` beyond the acceptance specs: its
// connections and options, its refusals, what it logs, and round trips of
// schemas that the fixtures do not have.

/**
 * A logger whose calls can be read back.
 */
function recordingLogger(): Logger & {
  readonly info: Mock<LogFn>;
  readonly warn: Mock<LogFn>;
} {
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
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-ts-extra-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * The files of a directory, or none when it is missing.
 */
async function filesOf(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Waits for a promise that should reject.
 *
 * @returns Its rejection reason, or `null` when it resolved.
 */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  return null;
}

/**
 * Inheritance children that override, drop or add what they inherit, and
 * merged columns (CONTRACT-TS.md §8: the emitters must reproduce them).
 */
const INHERITANCE = `
CREATE TABLE public.vehicles (
    id bigserial PRIMARY KEY,
    wheels smallint NOT NULL DEFAULT 4,
    plate text,
    registered_on date,
    note text
);
CREATE TABLE public.trucks (payload_kg integer NOT NULL) INHERITS (public.vehicles);
ALTER TABLE public.trucks ALTER COLUMN wheels SET DEFAULT 6;
ALTER TABLE public.trucks ALTER COLUMN plate SET NOT NULL;
CREATE TABLE public.buses (seats integer) INHERITS (public.vehicles);
ALTER TABLE public.buses ALTER COLUMN wheels DROP DEFAULT;
ALTER TABLE public.buses ALTER COLUMN registered_on SET DEFAULT CURRENT_DATE;
CREATE TABLE public.vans (plate text NOT NULL DEFAULT 'none', wheels smallint, doors integer) INHERITS (public.vehicles);
ALTER TABLE public.vans ALTER COLUMN wheels DROP DEFAULT;
CREATE TABLE public.dump_trucks (bed_m3 numeric) INHERITS (public.trucks);
ALTER TABLE public.dump_trucks ALTER COLUMN payload_kg SET DEFAULT 1000;
`;

/**
 * Partitions that drop a default of their partitioned table, and partition
 * indexes and keys with names of their own.
 */
const PARTITIONS = `
CREATE TABLE public.events (
    id bigint NOT NULL,
    kind text NOT NULL DEFAULT 'x',
    at date NOT NULL,
    PRIMARY KEY (id, at, kind)
) PARTITION BY RANGE (at);
CREATE TABLE public.events_2025 PARTITION OF public.events
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE public.events_other PARTITION OF public.events DEFAULT;
ALTER TABLE public.events_other ALTER COLUMN kind DROP DEFAULT;
CREATE TABLE public.events_2026 (id bigint NOT NULL, kind text NOT NULL, at date NOT NULL)
    PARTITION BY LIST (kind);
CREATE TABLE public.events_2026_x PARTITION OF public.events_2026 FOR VALUES IN ('x');
CREATE INDEX events_2026_x_kinds ON public.events_2026_x (kind);
CREATE INDEX events_2026_kinds ON public.events_2026 (kind);
ALTER TABLE public.events_2026 ADD CONSTRAINT events_2026_key PRIMARY KEY (id, at, kind);
ALTER TABLE public.events ATTACH PARTITION public.events_2026
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE INDEX events_kind_idx ON public.events (kind);
`;

/**
 * A comment on the sequence of an identity column.
 */
const IDENTITY_COMMENT = `
CREATE TABLE public.tickets (id integer GENERATED ALWAYS AS IDENTITY, title text);
COMMENT ON SEQUENCE public.tickets_id_seq IS 'Ticket numbers';
`;

/**
 * NOT NULL constraints of PostgreSQL 18 that inheritance children declare
 * themselves, one of them for a column their parent already has NOT NULL.
 */
const NOT_NULL_18 = `
CREATE TABLE public.parents (a integer NOT NULL, b integer, c integer NOT NULL);
CREATE TABLE public.children (d integer) INHERITS (public.parents);
ALTER TABLE public.children ALTER COLUMN a SET NOT NULL;
ALTER TABLE public.children ADD CONSTRAINT children_b_required NOT NULL b;
CREATE TABLE public.merged (a integer, c integer NOT NULL, e integer) INHERITS (public.parents);
`;

describe.each(PG_VERSIONS)(
  'baseline --format ts|js, more (PG %s)',
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
      const name = `extra_${databaseCount}`;
      await createDatabase(container, name);
      if (sql !== '') {
        await loadSql(container, name, sql);
      }

      return name;
    }

    /**
     * Makes a baseline of a database, runs it on a blank one and checks that
     * both have the same schema.
     */
    async function expectRoundTrip(
      sql: string,
      format: 'ts' | 'js' = 'ts'
    ): Promise<void> {
      const source = await databaseWith(sql);
      const dir = join(await tempDir(), 'migrations');
      await baseline({
        databaseUrl: databaseUrl(container, source),
        dir,
        format,
        logger: recordingLogger(),
      });
      const blank = await databaseWith('');
      await runner({
        databaseUrl: databaseUrl(container, blank),
        dir,
        direction: 'up',
        migrationsTable: 'pgmigrations',
        logger: recordingLogger(),
      });

      expect(await dumpSchema(container, blank)).toBe(
        await dumpSchema(container, source)
      );
    }

    it(
      'rebuilds inheritance children with their own defaults and NOT NULL',
      async () => {
        await expectRoundTrip(INHERITANCE);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds partitions with their own defaults and the names of their indexes and keys',
      async () => {
        await expectRoundTrip(PARTITIONS, 'js');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds the comment on an identity sequence',
      async () => {
        await expectRoundTrip(IDENTITY_COMMENT);
      },
      INTEGRATION_TIMEOUT
    );

    it.runIf(Number(postgresVersion) >= 18)(
      'rebuilds the NOT NULL constraints that inheritance children declare themselves',
      async () => {
        await expectRoundTrip(NOT_NULL_18);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'reads through a dbClient, which it leaves open, and logs the note and one warning',
      async () => {
        const database = await databaseWith(
          'CREATE TYPE public.float_range AS RANGE (subtype = float8);\nCREATE TABLE public.t (id integer);'
        );
        const client = new pg.Client(databaseUrl(container, database));
        await client.connect();
        onTestFinished(async () => {
          await client.end();
        });
        const dir = join(await tempDir(), 'migrations');
        const logger = recordingLogger();

        const result = await baseline({
          dbClient: client,
          dir,
          format: 'ts',
          logger,
        });

        expect(result.fallbacks).toStrictEqual([
          {
            kind: 'range',
            identity: 'public.float_range',
            reason: 'range type',
          },
        ]);
        expect(result.warnings).toHaveLength(1);
        expect(result.source).toStrictEqual({
          serverVersion: expect.stringMatching(/^\d+\.\d+/),
        });
        expect(logger.info.mock.calls.at(-1)).toStrictEqual([
          '> Note: --format ts is experimental; review the generated migration.',
        ]);
        expect(logger.warn.mock.calls).toStrictEqual([
          [`> Warning: ${result.warnings[0]}`],
        ]);
        // The client is still open.
        await expect(client.query('SELECT 1')).resolves.toBeDefined();
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'reads only the included schemas, and none of the excluded ones',
      async () => {
        const database = await databaseWith(
          [
            'CREATE SCHEMA app;',
            'CREATE SCHEMA audit;',
            'CREATE TABLE app.accounts (id integer);',
            'CREATE TABLE audit.entries (id integer);',
          ].join('\n')
        );
        const url = databaseUrl(container, database);

        const included = join(await tempDir(), 'migrations');
        const onlyApp = await baseline({
          databaseUrl: url,
          dir: included,
          format: 'ts',
          includeSchemas: ['app'],
          logger: recordingLogger(),
        });
        const excluded = join(await tempDir(), 'migrations');
        const withoutAudit = await baseline({
          databaseUrl: url,
          dir: excluded,
          format: 'ts',
          excludeSchemas: ['audit'],
          logger: recordingLogger(),
        });

        for (const { path } of [onlyApp, withoutAudit]) {
          const content = await readFile(path, 'utf8');
          expect(content).toContain("name: 'accounts'");
          expect(content).not.toContain('entries');
        }
      },
      INTEGRATION_TIMEOUT
    );

    it.each([
      {
        refusal: 'a database with migration history',
        sql: [
          'CREATE TABLE public.pgmigrations (id serial PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL);',
          "INSERT INTO public.pgmigrations (name, run_on) VALUES ('1_first', now());",
        ].join('\n'),
        options: {},
        code: 'HISTORY_EXISTS',
        fragments: ['already records 1 migration'],
      },
      {
        refusal: 'objects no migration can represent',
        sql: 'CREATE TEXT SEARCH CONFIGURATION public.plain (COPY = pg_catalog.simple);',
        options: {},
        code: 'UNSUPPORTED_OBJECTS',
        fragments: ['text search configuration public.plain', '--format sql'],
      },
      {
        refusal: 'identifiers that decamelize would rename',
        sql: 'CREATE TABLE public."LegacyCustomer" (id integer);',
        options: { decamelize: true },
        code: 'INVALID_OPTIONS',
        fragments: ['decamelize', 'LegacyCustomer'],
      },
      {
        refusal: 'raw SQL with strict',
        sql: 'CREATE TYPE public.float_range AS RANGE (subtype = float8);',
        options: { strict: true },
        code: 'UNSUPPORTED_OBJECTS',
        fragments: ['range public.float_range: range type', '--strict'],
      },
    ])(
      'refuses $refusal without writing anything',
      async ({ sql, options, code, fragments }) => {
        const database = await databaseWith(sql);
        const dir = join(await tempDir(), 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: databaseUrl(container, database),
            dir,
            format: 'ts',
            logger: recordingLogger(),
            ...options,
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toHaveProperty('code', code);
        for (const fragment of fragments) {
          expect((error as BaselineError).message).toContain(fragment);
        }

        expect(await filesOf(dir)).toStrictEqual([]);
      },
      INTEGRATION_TIMEOUT
    );
  }
);
