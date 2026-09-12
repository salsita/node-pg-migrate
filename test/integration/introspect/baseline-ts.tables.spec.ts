import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import type { BaselineResult } from '../../../src';
import { baseline, runner } from '../../../src';
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
import { catalogQuery } from './catalog';

// Round trips of `baseline({ format: 'ts' })` for tables, columns and
// materialized views: a database built by running the baseline on a blank
// database must have the same schema as the source, as `pg_dump` shows it.

/**
 * A logger that keeps the test output clean.
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
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-ts-tables-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * A table and a materialized view with TOAST storage parameters, which
 * `pg_dump` writes as `toast.autovacuum_enabled='false'`.
 */
const TOAST_TABLE = `
CREATE TABLE public.t (id integer PRIMARY KEY, a text)
    WITH (toast.autovacuum_enabled = false, fillfactor = 80);
`;

const TOAST_MATERIALIZED_VIEW = `
CREATE TABLE public.t (id integer PRIMARY KEY, a text);
CREATE MATERIALIZED VIEW public.mv WITH (toast.autovacuum_enabled = false)
    AS SELECT id, a FROM public.t;
`;

/**
 * A materialized view whose query calls a function that reads a view that
 * sorts after it: string-bodied SQL functions record no dependency on what
 * they read, so only an unpopulated materialized view can be created first.
 */
const MATERIALIZED_VIEW_READING_A_LATER_VIEW = `
CREATE TABLE public.t (id integer);
CREATE VIEW public.z_view AS SELECT id FROM public.t;
CREATE FUNCTION public.cnt() RETURNS bigint LANGUAGE sql STABLE
    AS $$ SELECT count(*) FROM public.z_view $$;
CREATE MATERIALIZED VIEW public.a_mv AS SELECT public.cnt() AS n;
`;

/**
 * A typed table (`CREATE TABLE … OF type`).
 */
const TYPED_TABLE = `
CREATE TYPE public.person AS (name text, age integer);
CREATE TABLE public.people OF public.person (
    PRIMARY KEY (name),
    age WITH OPTIONS DEFAULT 0
);
`;

/**
 * A partition that was created on its own, with its columns in another order
 * than its partitioned table's, then attached; and one created with
 * `PARTITION OF`. `ATTACH PARTITION` needs the partition to have the NOT NULL
 * and CHECK constraints its partitioned table has at that moment.
 */
const PARTITION_IN_ANOTHER_COLUMN_ORDER = `
CREATE TABLE public.m (
    id integer NOT NULL,
    ts date NOT NULL,
    v text,
    CONSTRAINT m_v_check CHECK (v <> '')
) PARTITION BY RANGE (ts);
CREATE TABLE public.m_2020 (
    v text,
    ts date NOT NULL,
    id integer NOT NULL,
    CONSTRAINT m_v_check CHECK (v <> '')
);
ALTER TABLE public.m ATTACH PARTITION public.m_2020
    FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');
CREATE TABLE public.m_2021 PARTITION OF public.m
    FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');
`;

/**
 * An inheritance child that gives a column it inherits a default with a line
 * break.
 */
const INHERITED_DEFAULT_WITH_LINE_BREAK = `
CREATE TABLE public.parent (id integer, note text);
CREATE TABLE public.kid (extra integer) INHERITS (public.parent);
ALTER TABLE public.kid ALTER COLUMN note SET DEFAULT E'line one\\nline two';
`;

/**
 * Column settings of materialized views: a statistics target, a storage, a
 * compression and options; `mv4` is also a fallback for its storage
 * parameters.
 */
const MATERIALIZED_VIEW_COLUMN_SETTINGS = `
CREATE TABLE public.t3 (x integer, y text, z text);
CREATE MATERIALIZED VIEW public.mv3 AS SELECT x, y, z FROM public.t3;
ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN y SET STATISTICS 200;
ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN y SET STORAGE EXTERNAL;
ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN z SET COMPRESSION pglz;
ALTER MATERIALIZED VIEW public.mv3 ALTER COLUMN x SET (n_distinct = 100);
CREATE MATERIALIZED VIEW public.mv4 WITH (fillfactor = 70)
    AS SELECT x FROM public.t3;
ALTER MATERIALIZED VIEW public.mv4 ALTER COLUMN x SET STATISTICS 300;
`;

/**
 * Comments on the NOT NULL constraints of tables (PostgreSQL 18): `t` has one
 * with the default name and one with its own (a whole-table fallback), `u`
 * needs no fallback itself.
 */
const TABLE_NOT_NULL_COMMENTS = `
CREATE TABLE public.t (a integer NOT NULL, b integer CONSTRAINT b_nn NOT NULL);
COMMENT ON CONSTRAINT t_a_not_null ON public.t IS 'a is required';
COMMENT ON CONSTRAINT b_nn ON public.t IS 'b is required';
CREATE TABLE public.u (a integer NOT NULL);
COMMENT ON CONSTRAINT u_a_not_null ON public.u IS 'u.a is required';
`;

/**
 * A comment on the NOT NULL constraint of a domain (PostgreSQL 17+).
 */
const DOMAIN_NOT_NULL_COMMENT = `
CREATE DOMAIN public.dn AS integer NOT NULL;
COMMENT ON CONSTRAINT dn_not_null ON DOMAIN public.dn IS 'no nulls';
`;

/**
 * A serial column whose sequence a function uses, and a column of the same
 * table whose default calls that function: without `serial`, the sequence,
 * the function and the table can be created one after the other.
 */
const SERIAL_SEQUENCE_USED_BY_A_DEFAULT = `
CREATE TABLE public.a (id serial PRIMARY KEY, v text);
CREATE FUNCTION public.next_code() RETURNS text LANGUAGE sql VOLATILE
BEGIN ATOMIC
    SELECT 'C-' || nextval('public.a_id_seq'::regclass);
END;
ALTER TABLE public.a ADD COLUMN code text DEFAULT public.next_code();
`;

describe.each(PG_VERSIONS)(
  'baseline --format ts, tables and materialized views (PG %s)',
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
      const name = `tables_${databaseCount}`;
      await createDatabase(container, name);
      if (sql !== '') {
        await loadSql(container, name, sql);
      }

      return name;
    }

    /**
     * Makes a TypeScript baseline of a new database with a schema.
     */
    async function baselineOf(sql: string): Promise<{
      readonly source: string;
      readonly dir: string;
      readonly result: BaselineResult;
    }> {
      const source = await databaseWith(sql);
      const dir = join(await tempDir(), 'migrations');
      const result = await baseline({
        databaseUrl: databaseUrl(container, source),
        dir,
        format: 'ts',
        logger: silentLogger(),
      });

      return { source, dir, result };
    }

    /**
     * Runs the migrations of a directory on a new, blank database.
     *
     * @returns The name of the database.
     */
    async function rebuild(dir: string): Promise<string> {
      const blank = await databaseWith('');
      await runner({
        databaseUrl: databaseUrl(container, blank),
        dir,
        direction: 'up',
        migrationsTable: 'pgmigrations',
        logger: silentLogger(),
      });

      return blank;
    }

    /**
     * Checks that a database rebuilt from a baseline has the schema of its
     * source.
     */
    async function expectSameSchema(
      blank: string,
      source: string
    ): Promise<void> {
      expect(await dumpSchema(container, blank)).toBe(
        await dumpSchema(container, source)
      );
    }

    it(
      'rebuilds a table with a TOAST storage parameter',
      async () => {
        const { source, dir } = await baselineOf(TOAST_TABLE);

        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds a materialized view with a TOAST storage parameter',
      async () => {
        const { source, dir } = await baselineOf(TOAST_MATERIALIZED_VIEW);

        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'creates materialized views unpopulated, so that a function their query calls may read a view created after them',
      async () => {
        const { source, dir } = await baselineOf(
          MATERIALIZED_VIEW_READING_A_LATER_VIEW
        );

        const blank = await rebuild(dir);

        await expectSameSchema(blank, source);
        expect(
          await catalogQuery(
            container,
            blank,
            "SELECT relispopulated FROM pg_catalog.pg_class WHERE oid = 'public.a_mv'::pg_catalog.regclass"
          )
        ).toBe('f');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds a typed table as a typed table, reporting it as a typed table fallback',
      async () => {
        const { source, dir, result } = await baselineOf(TYPED_TABLE);

        expect.soft(result.fallbacks ?? []).toContainEqual({
          kind: 'table',
          identity: 'public.people',
          reason: 'typed table',
        });
        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      "rebuilds a partition whose columns are in another order than its partitioned table's",
      async () => {
        const { source, dir } = await baselineOf(
          PARTITION_IN_ANOTHER_COLUMN_ORDER
        );

        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'keeps the line break of the default an inheritance child gives a column it inherits, as a line break fallback',
      async () => {
        const { source, dir, result } = await baselineOf(
          INHERITED_DEFAULT_WITH_LINE_BREAK
        );

        expect.soft(result.fallbacks ?? []).toContainEqual({
          kind: 'table',
          identity: 'public.kid',
          reason: 'line break',
        });
        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'keeps the statistics target, storage, compression and options of the columns of materialized views, as column settings fallbacks',
      async () => {
        const { source, dir, result } = await baselineOf(
          MATERIALIZED_VIEW_COLUMN_SETTINGS
        );

        expect.soft(result.fallbacks ?? []).toContainEqual(
          expect.objectContaining({
            identity: 'public.mv3',
            reason: 'column settings',
          })
        );
        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it.runIf(Number(postgresVersion) >= 18)(
      'keeps the comments on the NOT NULL constraints of tables, as comment on constraint fallbacks',
      async () => {
        const { source, dir, result } = await baselineOf(
          TABLE_NOT_NULL_COMMENTS
        );

        expect.soft(result.fallbacks ?? []).toContainEqual(
          expect.objectContaining({
            reason: expect.stringContaining('comment on constraint'),
          })
        );
        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it.runIf(Number(postgresVersion) >= 17)(
      'keeps the comment on the NOT NULL constraint of a domain, as a comment on constraint fallback',
      async () => {
        const { source, dir, result } = await baselineOf(
          DOMAIN_NOT_NULL_COMMENT
        );

        expect.soft(result.fallbacks ?? []).toContainEqual(
          expect.objectContaining({
            reason: expect.stringContaining('comment on constraint'),
          })
        );
        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'rebuilds a serial column whose sequence a function uses in a default of the same table, instead of refusing a cycle',
      async () => {
        const { source, dir } = await baselineOf(
          SERIAL_SEQUENCE_USED_BY_A_DEFAULT
        );

        await expectSameSchema(await rebuild(dir), source);
      },
      INTEGRATION_TIMEOUT
    );
  }
);
