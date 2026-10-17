import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
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
import type { BaselineResult } from '../../../src';
import { baseline, runner } from '../../../src';
import type { Fallback } from '../../../src/codegen/fallback';
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
import { fallbackComments } from './catalog';

// `baseline({ format: 'ts' | 'js' })` must create the schema as it is: what
// its indexes, triggers, functions and types have that `pgm` calls cannot
// say is kept with raw SQL, and a name that `decamelize` would change is
// refused. Each spec rebuilds the schema on a blank database from the
// baseline and compares it with the source.

/**
 * Baselining a schema and rebuilding it takes several round trips.
 */
const ROUND_TRIP_TIMEOUT = INTEGRATION_TIMEOUT * 2;

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
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-ts-fidelity-'));
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
 * Every reason of some fallbacks, one per entry (a fallback with several
 * reasons has them joined with `', '`).
 */
function reasonsOf(fallbacks: ReadonlyArray<Fallback>): string[] {
  return fallbacks.flatMap(({ reason }) => reason.split(', '));
}

/**
 * Runs a query in a database and returns the first column of each row.
 */
async function queryColumn(url: string, sql: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ value: string }>(sql);

    return rows.map(({ value }) => value);
  } finally {
    await client.end();
  }
}

/**
 * Every trigger of the user, clones on partitions included (up to PostgreSQL
 * 14 a clone is `tgisinternal`): its table, name, firing mode (`tgenabled`)
 * and comment. pg_dump only writes a clone when its firing mode is not its
 * parent's, and so leaves out the comment on a clone that fires like its
 * parent.
 */
const TRIGGER_STATES = `SELECT pg_catalog.concat_ws(' | ', c.relname, t.tgname, t.tgenabled, pg_catalog.obj_description(t.oid, 'pg_trigger')) AS value
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal OR t.tgparentid <> 0
ORDER BY 1`;

/**
 * Rows that make `CREATE UNIQUE INDEX CONCURRENTLY` fail while it builds the
 * index, which it leaves behind not ready and not valid: pg_dump leaves it
 * out.
 */
const DUPLICATE_ROWS = `
CREATE TABLE public.t (id integer);
INSERT INTO public.t VALUES (1), (1);
`;

/**
 * Whether an index is ready (`indisready`) and valid (`indisvalid`), e.g.
 * `t f`.
 */
function indexState(name: string): string {
  return `SELECT pg_catalog.concat_ws(' ', i.indisready, i.indisvalid) AS value
FROM pg_catalog.pg_index AS i
JOIN pg_catalog.pg_class AS c ON c.oid = i.indexrelid
WHERE c.relname = '${name}'`;
}

/**
 * Partitioned indexes created `ON ONLY` their table: `m_v_idx` has the index
 * of one partition attached and not the other's, `m_id_idx` none, so both
 * stay not valid.
 */
const ON_ONLY_INDEXES = `
CREATE TABLE public.m (id integer NOT NULL, v text) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE TABLE public.m_2 PARTITION OF public.m FOR VALUES FROM (100) TO (200);
CREATE INDEX m_v_idx ON ONLY public.m (v);
CREATE INDEX m_1_v_idx ON public.m_1 (v);
ALTER INDEX public.m_v_idx ATTACH PARTITION public.m_1_v_idx;
CREATE INDEX m_id_idx ON ONLY public.m (id);
`;

/**
 * A row trigger of a partitioned table whose clones on the partitions fire
 * otherwise than it does.
 */
const CLONED_TRIGGER_MODES = `
CREATE FUNCTION public.touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TABLE public.m (id integer NOT NULL) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE TABLE public.m_2 PARTITION OF public.m FOR VALUES FROM (100) TO (200);
CREATE TABLE public.m_3 PARTITION OF public.m FOR VALUES FROM (200) TO (300);
CREATE TABLE public.m_4 PARTITION OF public.m FOR VALUES FROM (300) TO (400);
CREATE TRIGGER m_touch BEFORE INSERT ON public.m FOR EACH ROW EXECUTE FUNCTION public.touch();
ALTER TABLE public.m_1 DISABLE TRIGGER m_touch;
ALTER TABLE public.m_2 ENABLE REPLICA TRIGGER m_touch;
ALTER TABLE public.m_3 ENABLE ALWAYS TRIGGER m_touch;
`;

/**
 * A disabled row trigger of a partitioned table whose clone on one partition
 * fires: disabling the trigger of the partitioned table disables its clones
 * too, so the clone is enabled afterwards.
 */
const CLONE_ENABLED_UNDER_DISABLED_TRIGGER = `
CREATE FUNCTION public.touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TABLE public.m (id integer NOT NULL) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE TABLE public.m_2 PARTITION OF public.m FOR VALUES FROM (100) TO (200);
CREATE TRIGGER m_audit AFTER INSERT ON public.m FOR EACH ROW EXECUTE FUNCTION public.touch();
ALTER TABLE public.m DISABLE TRIGGER m_audit;
ALTER TABLE public.m_2 ENABLE TRIGGER m_audit;
`;

/**
 * Comments on the clones of a trigger of a partitioned table: one on a
 * disabled clone, one on a clone that fires like its parent.
 */
const CLONED_TRIGGER_COMMENTS = `
CREATE FUNCTION public.touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TABLE public.m (id integer NOT NULL) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE TABLE public.m_2 PARTITION OF public.m FOR VALUES FROM (100) TO (200);
CREATE TRIGGER m_touch BEFORE INSERT ON public.m FOR EACH ROW EXECUTE FUNCTION public.touch();
ALTER TABLE public.m_1 DISABLE TRIGGER m_touch;
COMMENT ON TRIGGER m_touch ON public.m_1 IS 'Disabled on the first partition';
COMMENT ON TRIGGER m_touch ON public.m_2 IS 'Fires on the second partition';
`;

/**
 * A function with a planner support function.
 */
const SUPPORT_FUNCTION = `
CREATE FUNCTION public.w1(text, text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
    SUPPORT pg_catalog.textlike_support AS $$ SELECT $1 LIKE $2 $$;
`;

/**
 * Comments and storage parameters on the indexes that partitions get from
 * an index and a primary key of their partitioned table.
 */
const PARTITION_INDEX_SETTINGS = `
CREATE TABLE public.m (id integer NOT NULL, v text, PRIMARY KEY (id)) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE INDEX m_v_idx ON public.m (v);
COMMENT ON INDEX public.m_1_v_idx IS 'Partition index comment';
COMMENT ON INDEX public.m_1_pkey IS 'Partition key index comment';
ALTER INDEX public.m_1_v_idx SET (fillfactor = 70);
ALTER INDEX public.m_1_pkey SET (fillfactor = 80);
`;

/**
 * Partitions clustered on, and using as their replica identity, the index
 * they get from an index or the primary key of their partitioned table.
 */
const PARTITION_INDEX_CLUSTER = `
CREATE TABLE public.m (id integer NOT NULL, v text NOT NULL) PARTITION BY RANGE (id);
CREATE TABLE public.m_1 PARTITION OF public.m FOR VALUES FROM (0) TO (100);
CREATE UNIQUE INDEX m_uidx ON public.m (id, v);
ALTER TABLE public.m_1 CLUSTER ON m_1_id_v_idx;
ALTER TABLE public.m_1 REPLICA IDENTITY USING INDEX m_1_id_v_idx;
CREATE TABLE public.n (id integer PRIMARY KEY) PARTITION BY RANGE (id);
CREATE TABLE public.n_1 PARTITION OF public.n FOR VALUES FROM (0) TO (100);
ALTER TABLE public.n_1 CLUSTER ON n_1_pkey;
ALTER TABLE public.n_1 REPLICA IDENTITY USING INDEX n_1_pkey;
`;

/**
 * A statistics target on the expression column of an index.
 */
const INDEX_STATISTICS = `
CREATE TABLE public.t3 (id integer, a text);
CREATE INDEX t3_expr ON public.t3 ((lower(a)));
ALTER INDEX public.t3_expr ALTER COLUMN 1 SET STATISTICS 500;
`;

/**
 * A standalone shell type: `CREATE TYPE` with a name only.
 */
const SHELL_TYPE = `
CREATE TYPE public.shell_t;
CREATE TABLE public.t (id integer);
`;

describe.each(PG_VERSIONS)(
  'baseline --format ts|js keeps indexes, triggers, functions and types (PG %s)',
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
      const name = `fidelity_${databaseCount}`;
      await createDatabase(container, name);
      if (sql !== '') {
        await loadSql(container, name, sql);
      }

      return name;
    }

    /**
     * Makes a TypeScript baseline of a database, runs it on a blank one and
     * checks that both have the same schema.
     *
     * @returns What `baseline()` returned, the content of the migration and
     * the blank database.
     */
    async function expectRoundTrip(source: string): Promise<{
      readonly result: BaselineResult;
      readonly content: string;
      readonly blank: string;
    }> {
      const dir = join(await tempDir(), 'migrations');
      const result = await baseline({
        databaseUrl: databaseUrl(container, source),
        dir,
        format: 'ts',
        logger: silentLogger(),
      });
      const content = await readFile(result.path, 'utf8');
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

      return { result, content, blank };
    }

    describe('indexes that are not valid', () => {
      it(
        'leaves out an index that a failed CREATE INDEX CONCURRENTLY left behind, like pg_dump',
        async () => {
          const source = await databaseWith(DUPLICATE_ROWS);
          const url = databaseUrl(container, source);
          const client = new pg.Client({ connectionString: url });
          await client.connect();
          try {
            await expect(
              client.query(
                'CREATE UNIQUE INDEX CONCURRENTLY t_id_uidx ON public.t (id)'
              )
            ).rejects.toThrow('could not create unique index');
          } finally {
            await client.end();
          }

          expect(await queryColumn(url, indexState('t_id_uidx'))).toStrictEqual(
            ['f f']
          );

          const { content } = await expectRoundTrip(source);

          expect(content).not.toContain('t_id_uidx');
        },
        ROUND_TRIP_TIMEOUT
      );

      it(
        'leaves out an index that a canceled CREATE INDEX CONCURRENTLY left ready but not valid, like pg_dump',
        async () => {
          const source = await databaseWith(
            'CREATE TABLE public.t (id integer, a text);'
          );
          const url = databaseUrl(container, source);
          const holder = new pg.Client({ connectionString: url });
          const builder = new pg.Client({ connectionString: url });
          const watcher = new pg.Client({ connectionString: url });
          await Promise.all([
            holder.connect(),
            builder.connect(),
            watcher.connect(),
          ]);
          try {
            // CREATE INDEX CONCURRENTLY waits for this older snapshot after it
            // marks the index ready, before it marks it valid: it is canceled
            // while it waits. Nothing else makes it wait for this session.
            await holder.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
            await holder.query('SELECT 1');
            const [holderPid, builderPid] = await Promise.all(
              [holder, builder].map(async (client) => {
                const { rows } = await client.query<{ pid: number }>(
                  'SELECT pg_catalog.pg_backend_pid() AS pid'
                );

                return rows[0].pid;
              })
            );
            const building = rejectionOf(
              builder.query('CREATE INDEX CONCURRENTLY t_a_idx ON public.t (a)')
            );
            await vi.waitFor(
              async () => {
                const { rows } = await watcher.query<{ waits: boolean }>(
                  'SELECT $1::pg_catalog.int4 = ANY (pg_catalog.pg_blocking_pids($2::pg_catalog.int4)) AS waits',
                  [holderPid, builderPid]
                );
                expect(rows).toStrictEqual([{ waits: true }]);
              },
              { timeout: INTEGRATION_TIMEOUT / 2, interval: 50 }
            );
            await watcher.query(
              'SELECT pg_catalog.pg_cancel_backend($1::pg_catalog.int4)',
              [builderPid]
            );

            expect(await building).toMatchObject({
              message: expect.stringContaining('canceling statement'),
            });
          } finally {
            await Promise.all([holder.end(), builder.end(), watcher.end()]);
          }

          expect(await queryColumn(url, indexState('t_a_idx'))).toStrictEqual([
            't f',
          ]);

          const { content } = await expectRoundTrip(source);

          expect(content).not.toContain('t_a_idx');
        },
        ROUND_TRIP_TIMEOUT
      );

      it(
        'keeps a partitioned index created ON ONLY that is not valid, with only the partition indexes attached to it',
        async () => {
          const source = await databaseWith(ON_ONLY_INDEXES);
          const url = databaseUrl(container, source);
          for (const name of ['m_v_idx', 'm_id_idx']) {
            expect(await queryColumn(url, indexState(name))).toStrictEqual([
              't f',
            ]);
          }

          const { result, content } = await expectRoundTrip(source);

          for (const identity of ['public.m_v_idx', 'public.m_id_idx']) {
            expect(
              reasonsOf(
                (result.fallbacks ?? []).filter(
                  (fallback) => fallback.identity === identity
                )
              )
            ).toContain('invalid index');
          }

          expect(content).toContain('ON ONLY');
          expect(content).toContain('ATTACH PARTITION');
        },
        ROUND_TRIP_TIMEOUT
      );
    });

    describe('triggers that partitions clone', () => {
      /**
       * Checks that two databases have the same triggers, clones on
       * partitions included, with the same firing modes and comments.
       */
      async function expectSameTriggerStates(
        blank: string,
        source: string
      ): Promise<void> {
        expect(
          await queryColumn(databaseUrl(container, blank), TRIGGER_STATES)
        ).toStrictEqual(
          await queryColumn(databaseUrl(container, source), TRIGGER_STATES)
        );
      }

      it(
        'keeps the firing mode of the clones on the partitions',
        async () => {
          const source = await databaseWith(CLONED_TRIGGER_MODES);

          const { result, content, blank } = await expectRoundTrip(source);

          await expectSameTriggerStates(blank, source);
          expect(reasonsOf(result.fallbacks ?? [])).toContain('firing mode');
          expect(fallbackComments(content).join(', ')).toContain('firing mode');
        },
        ROUND_TRIP_TIMEOUT
      );

      it(
        'keeps a clone that fires under a disabled trigger of its partitioned table',
        async () => {
          const source = await databaseWith(
            CLONE_ENABLED_UNDER_DISABLED_TRIGGER
          );

          const { blank } = await expectRoundTrip(source);

          await expectSameTriggerStates(blank, source);
        },
        ROUND_TRIP_TIMEOUT
      );

      it(
        'keeps the comments on the clones on the partitions',
        async () => {
          const source = await databaseWith(CLONED_TRIGGER_COMMENTS);

          const { result, blank } = await expectRoundTrip(source);

          await expectSameTriggerStates(blank, source);
          expect(reasonsOf(result.fallbacks ?? [])).toContain(
            'comment on trigger'
          );
        },
        ROUND_TRIP_TIMEOUT
      );
    });

    it(
      'writes a function with a SUPPORT function from its definition, keeping SUPPORT',
      async () => {
        const source = await databaseWith(SUPPORT_FUNCTION);

        const { result, content } = await expectRoundTrip(source);

        expect(result.fallbacks).toContainEqual({
          kind: 'function',
          identity: 'public.w1(text, text)',
          reason: 'support function',
        });
        expect(content).toContain('SUPPORT');
      },
      ROUND_TRIP_TIMEOUT
    );

    describe('settings of partition indexes', () => {
      it(
        'keeps their comments and storage parameters',
        async () => {
          await expectRoundTrip(await databaseWith(PARTITION_INDEX_SETTINGS));
        },
        ROUND_TRIP_TIMEOUT
      );

      it(
        'keeps CLUSTER ON and REPLICA IDENTITY USING INDEX on them',
        async () => {
          await expectRoundTrip(await databaseWith(PARTITION_INDEX_CLUSTER));
        },
        ROUND_TRIP_TIMEOUT
      );
    });

    it(
      'keeps the statistics target of an expression column of an index',
      async () => {
        const source = await databaseWith(INDEX_STATISTICS);

        const { result } = await expectRoundTrip(source);

        expect(result.fallbacks).toContainEqual({
          kind: 'index',
          identity: 'public.t3_expr',
          reason: 'column settings',
        });
      },
      ROUND_TRIP_TIMEOUT
    );

    it(
      'writes a standalone shell type',
      async () => {
        const source = await databaseWith(SHELL_TYPE);

        const { result, content } = await expectRoundTrip(source);

        expect(result.fallbacks).toContainEqual(
          expect.objectContaining({
            identity: 'public.shell_t',
            reason: 'shell type',
          })
        );
        expect(fallbackComments(content)).toContain('shell type');
      },
      ROUND_TRIP_TIMEOUT
    );

    describe('names that decamelize would change', () => {
      /**
       * Checks that a decamelized baseline of a database is refused, naming
       * the identifiers and what decamelize would make of them, and that it
       * writes nothing.
       */
      async function expectDecamelizeRefusal(
        sql: string,
        fragments: ReadonlyArray<string>
      ): Promise<void> {
        const source = await databaseWith(sql);
        const dir = join(await tempDir(), 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: databaseUrl(container, source),
            dir,
            format: 'ts',
            decamelize: true,
            logger: silentLogger(),
          })
        );

        expect(error).toMatchObject({ code: 'INVALID_OPTIONS' });
        const { message } = error as Error;
        expect(message).toContain('decamelize');
        for (const fragment of fragments) {
          expect(message).toContain(fragment);
        }

        expect(await filesOf(dir)).toStrictEqual([]);
      }

      it.each([
        {
          identifier: 'the name of a CHECK constraint of a domain',
          sql: [
            'CREATE DOMAIN public.posint AS integer CONSTRAINT "PositiveCheck" CHECK (VALUE > 0);',
            'CREATE TABLE public.t (id public.posint);',
          ].join('\n'),
          fragments: ['"PositiveCheck" (as positive_check)'],
        },
        {
          identifier:
            'the name of the key of a partition, which addConstraint adds',
          sql: [
            'CREATE TABLE public.m (id integer NOT NULL, v text) PARTITION BY RANGE (id);',
            'CREATE TABLE public.m_1 (id integer NOT NULL, v text);',
            'ALTER TABLE public.m_1 ADD CONSTRAINT "PartKey" PRIMARY KEY (id);',
            'ALTER TABLE public.m ATTACH PARTITION public.m_1 FOR VALUES FROM (0) TO (10);',
            'ALTER TABLE public.m ADD CONSTRAINT m_pkey PRIMARY KEY (id);',
          ].join('\n'),
          fragments: ['"PartKey" (as part_key)'],
        },
        {
          identifier: 'the names of the settings of a function',
          sql: `CREATE FUNCTION public.tenant() RETURNS text LANGUAGE sql SET timezone TO 'UTC' SET "myApp.tenantId" TO 'acme' AS $$ SELECT current_setting('myApp.tenantId', true) $$;`,
          fragments: [
            '"TimeZone" (as time_zone)',
            '"myApp.tenantId" (as my_app.tenant_id)',
          ],
        },
      ])(
        'refuses $identifier',
        async ({ sql, fragments }) => {
          await expectDecamelizeRefusal(sql, fragments);
        },
        INTEGRATION_TIMEOUT
      );

      it.runIf(Number(postgresVersion) >= 17)(
        'refuses the name of the NOT NULL constraint of a domain',
        async () => {
          await expectDecamelizeRefusal(
            'CREATE DOMAIN public.quantity AS integer CONSTRAINT "QuantityRequired" NOT NULL;',
            ['"QuantityRequired" (as quantity_required)']
          );
        },
        INTEGRATION_TIMEOUT
      );

      it.runIf(Number(postgresVersion) >= 18)(
        'refuses the name of a NOT NULL constraint that addConstraint adds to an inheritance child',
        async () => {
          await expectDecamelizeRefusal(
            [
              'CREATE TABLE public.parents (a integer, b integer);',
              'CREATE TABLE public.children (c integer) INHERITS (public.parents);',
              'ALTER TABLE public.children ADD CONSTRAINT "ChildrenBRequired" NOT NULL b;',
            ].join('\n'),
            ['"ChildrenBRequired" (as children_b_required)']
          );
        },
        INTEGRATION_TIMEOUT
      );
    });
  }
);
