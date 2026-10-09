import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
import { baseline, BaselineError, jiti, runner } from '../../../src';
import type { Fallback } from '../../../src/codegen/fallback';
import type { LogFn, Logger } from '../../../src/logger';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import {
  catalogFallbacks,
  countReasons,
  fallbackComments,
  identityPattern,
  sortFallbacks,
} from './catalog';

/**
 * Baselining a fixture and rebuilding it takes several round trips.
 */
const ROUND_TRIP_TIMEOUT = INTEGRATION_TIMEOUT * 2;

/**
 * What the kitchen sink needs raw SQL for, on every server version, beyond
 * what {@link catalogFallbacks} reads from the catalogs (its partitions,
 * collation, range type, aggregate, procedure, SQL-standard body, restrictive
 * policy, the trigger with a transition table, and PostgreSQL 18's virtual
 * generated column). Each entry follows a
 * rule of the emitters' JSDoc (`src/codegen/emitters/*.ts`).
 */
const KITCHEN_SINK_FALLBACKS: ReadonlyArray<Fallback> = [
  // 02-types.sql: `createDomain` takes one constraint, and `money_amount` has
  // a NOT NULL and a CHECK.
  {
    kind: 'domain',
    identity: 'kitchen.money_amount',
    reason: 'several constraints',
  },
  // 05-tables.sql: a whole table is one fallback when it has column settings
  // (`SET STATISTICS 500`, `SET STORAGE EXTERNAL`) or storage parameters.
  {
    kind: 'table',
    identity: 'kitchen.customers',
    reason: 'column settings',
  },
  {
    kind: 'table',
    identity: 'kitchen.products',
    reason: 'storage parameters',
  },
  {
    kind: 'table',
    identity: 'kitchen.session_cache',
    reason: 'storage parameters, column settings',
  },
  // 06-indexes.sql: what `createIndex` can't express, in the order of the
  // index emitter's reasons.
  {
    kind: 'index',
    identity: 'kitchen.customers_name_idx',
    reason: 'nulls order',
  },
  {
    kind: 'index',
    identity: 'kitchen.customers_last_name_trgm_idx',
    reason: 'operator class',
  },
  {
    kind: 'index',
    identity: 'kitchen.customers_settings_idx',
    reason: 'operator class',
  },
  {
    kind: 'index',
    identity: 'kitchen.orders_placed_at_brin_idx',
    reason: 'index method brin, storage parameters',
  },
  {
    kind: 'index',
    identity: 'kitchen.order_lines_product_idx',
    reason: 'storage parameters',
  },
  // 06-indexes.sql: `ALTER TABLE kitchen.orders CLUSTER ON orders_pkey`.
  {
    kind: 'constraint',
    identity: 'orders_pkey on kitchen.orders',
    reason: 'CLUSTER ON',
  },
  // 12-comments.sql: every comment but the ones on tables and their columns,
  // which are set with the table.
  { kind: 'comment', identity: 'kitchen', reason: 'comment on schema' },
  { kind: 'comment', identity: 'kitchen_audit', reason: 'comment on schema' },
  { kind: 'comment', identity: 'kitchen.mood', reason: 'comment on type' },
  {
    kind: 'comment',
    identity: 'kitchen.postal_address',
    reason: 'comment on type',
  },
  {
    kind: 'comment',
    identity: 'kitchen.email_address',
    reason: 'comment on domain',
  },
  {
    kind: 'comment',
    identity: 'kitchen.float_range',
    reason: 'comment on type',
  },
  {
    kind: 'comment',
    identity: 'kitchen.bytewise',
    reason: 'comment on collation',
  },
  {
    kind: 'comment',
    identity: 'kitchen.invoice_number',
    reason: 'comment on sequence',
  },
  {
    kind: 'comment',
    identity: 'orders_shipped_after_placed on kitchen.orders',
    reason: 'comment on constraint',
  },
  {
    kind: 'comment',
    identity: 'kitchen.customers_email_lower_idx',
    reason: 'comment on index',
  },
  {
    kind: 'comment',
    identity: 'kitchen.active_customers',
    reason: 'comment on view',
  },
  {
    kind: 'comment',
    identity: 'kitchen.customer_totals',
    reason: 'comment on materialized view',
  },
  {
    kind: 'comment',
    identity: 'kitchen.customer_order_total(p_customer_id bigint)',
    reason: 'comment on function',
  },
  {
    kind: 'comment',
    identity:
      'kitchen.purge_cancelled_orders(IN p_before timestamp with time zone, INOUT p_purged integer)',
    reason: 'comment on procedure',
  },
  {
    kind: 'comment',
    identity: 'kitchen.pipe_agg(text)',
    reason: 'comment on aggregate',
  },
  {
    kind: 'comment',
    identity: 'kitchen.=~=(numeric, numeric)',
    reason: 'comment on operator',
  },
  {
    kind: 'comment',
    identity: 'customers_touch on kitchen.customers',
    reason: 'comment on trigger',
  },
  {
    kind: 'comment',
    identity: 'documents_tenant_isolation on kitchen.documents',
    reason: 'comment on policy',
  },
];

/**
 * A logger that keeps the test output clean.
 *
 * @returns The logger.
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
 *
 * @returns The path of the directory.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pgm-baseline-ts-'));
  onTestFinished(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * The files of a directory, without the ones whose name starts with a dot.
 *
 * @param dir The directory.
 *
 * @returns The file names in order, or none when the directory is missing.
 */
async function migrationFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir))
      .filter((file) => !file.startsWith('.'))
      .toSorted();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

/**
 * Checks that `baseline()` wrote exactly one migration of the given language,
 * with the `--fake` command and the experimental note in its header, and a
 * `down` that refuses to undo it.
 *
 * @param result What `baseline()` returned.
 * @param dir The migrations directory it was given.
 * @param extension The file extension of the language, `ts` or `js`.
 *
 * @returns The content of the migration.
 */
async function expectMigrationWritten(
  result: BaselineResult,
  dir: string,
  extension: 'ts' | 'js'
): Promise<string> {
  expect(result.migrationName).toMatch(/^\d+_baseline$/);
  expect(await migrationFiles(dir)).toEqual([
    `${result.migrationName}.${extension}`,
  ]);
  expect(result.path).toBe(join(dir, `${result.migrationName}.${extension}`));

  const content = await readFile(result.path, 'utf8');
  expect(content).toContain(result.fakeCommand);
  expect(content).toMatch(/experimental/i);
  const migration = await jiti.import<{ readonly down?: unknown }>(result.path);
  expect(migration.down).toBe(false);

  return content;
}

/**
 * Waits for a promise that should reject.
 *
 * @param promise The promise.
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

describe.each(PG_VERSIONS)(
  'baseline --format ts|js (PG %s)',
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
     * Creates a database with a name no other test uses.
     *
     * @param prefix The start of the name.
     *
     * @returns The name of the new database.
     */
    async function newDatabase(prefix: string): Promise<string> {
      databaseCount += 1;
      const name = `${prefix}_${databaseCount}`;
      await createDatabase(container, name);

      return name;
    }

    /**
     * Creates a database and loads a fixture into it.
     *
     * @param fixture The fixture.
     *
     * @returns The name of the database.
     */
    async function sourceWith(
      fixture: 'chinook' | 'pagila' | 'kitchen-sink'
    ): Promise<string> {
      const source = await newDatabase(
        `source_${fixture.replaceAll('-', '_')}`
      );
      await loadFixture(container, source, fixture);

      return source;
    }

    /**
     * Runs the migrations of a directory on a new, blank database.
     *
     * @param dir The migrations directory.
     *
     * @returns The name of the database.
     */
    async function rebuild(dir: string): Promise<string> {
      const blank = await newDatabase('blank');
      await runner({
        databaseUrl: databaseUrl(container, blank),
        dir,
        direction: 'up',
        migrationsTable: 'pgmigrations',
        logger: silentLogger(),
      });

      return blank;
    }

    it(
      'rebuilds Chinook from a strict TypeScript baseline without fallbacks',
      async () => {
        const source = await sourceWith('chinook');
        const dir = join(await tempDir(), 'migrations');

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          dir,
          format: 'ts',
          strict: true,
          logger: silentLogger(),
        });

        expect(result.fallbacks).toEqual([]);
        const content = await expectMigrationWritten(result, dir, 'ts');
        expect(fallbackComments(content)).toEqual([]);
        const blank = await rebuild(dir);
        expect(await dumpSchema(container, blank)).toBe(
          await dumpSchema(container, source)
        );
      },
      ROUND_TRIP_TIMEOUT
    );

    it(
      'writes triggers on UPDATE OF columns as pgm.createTrigger calls, quoting the names that need it',
      async () => {
        const source = await newDatabase('update_of');
        await loadSql(
          container,
          source,
          `CREATE TABLE public.accounts (
             id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             email text NOT NULL,
             "displayName" text,
             "order" integer,
             is_member boolean NOT NULL DEFAULT false
           );
           CREATE FUNCTION public.accounts_touch() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$;
           CREATE TRIGGER accounts_membership AFTER INSERT OR UPDATE OF is_member ON public.accounts
             FOR EACH ROW EXECUTE FUNCTION public.accounts_touch();
           CREATE TRIGGER accounts_profile AFTER UPDATE OF email, "displayName", "order" ON public.accounts
             FOR EACH STATEMENT EXECUTE FUNCTION public.accounts_touch();
           CREATE CONSTRAINT TRIGGER accounts_order AFTER UPDATE OF "order" ON public.accounts
             DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.accounts_touch();`
        );
        const dir = join(await tempDir(), 'migrations');

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          dir,
          format: 'ts',
          strict: true,
          logger: silentLogger(),
        });

        expect(result.fallbacks).toEqual([]);
        const content = await expectMigrationWritten(result, dir, 'ts');
        expect(content).toContain('UPDATE OF is_member');
        expect(content).toContain('UPDATE OF email, "displayName", "order"');
        const blank = await rebuild(dir);
        expect(await dumpSchema(container, blank)).toBe(
          await dumpSchema(container, source)
        );
      },
      ROUND_TRIP_TIMEOUT
    );

    it(
      'rebuilds Chinook from a JavaScript baseline',
      async () => {
        const source = await sourceWith('chinook');
        const dir = join(await tempDir(), 'migrations');

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          dir,
          format: 'js',
          logger: silentLogger(),
        });

        expect(result.fallbacks).toEqual([]);
        await expectMigrationWritten(result, dir, 'js');
        const blank = await rebuild(dir);
        expect(await dumpSchema(container, blank)).toBe(
          await dumpSchema(container, source)
        );
      },
      ROUND_TRIP_TIMEOUT
    );

    it.each([
      { fixture: 'kitchen-sink', besides: KITCHEN_SINK_FALLBACKS },
      { fixture: 'pagila', besides: [] },
    ] as const)(
      'rebuilds $fixture, reporting exactly the objects it creates with raw SQL',
      async ({ fixture, besides }) => {
        const source = await sourceWith(fixture);
        const expected = sortFallbacks([
          ...(await catalogFallbacks(container, source)),
          ...besides,
        ]);
        const dir = join(await tempDir(), 'migrations');

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          dir,
          format: 'ts',
          logger: silentLogger(),
        });

        expect.soft(sortFallbacks(result.fallbacks ?? [])).toEqual(expected);
        const content = await expectMigrationWritten(result, dir, 'ts');
        // Each fallback is a pgm.sql() call under a `// fallback:` comment.
        expect
          .soft(countReasons(fallbackComments(content)))
          .toEqual(countReasons(expected.map(({ reason }) => reason)));
        const blank = await rebuild(dir);
        expect(await dumpSchema(container, blank)).toBe(
          await dumpSchema(container, source)
        );
      },
      ROUND_TRIP_TIMEOUT
    );

    it(
      'refuses a strict baseline of Pagila, listing every object that needs raw SQL',
      async () => {
        const source = await sourceWith('pagila');
        const expected = await catalogFallbacks(container, source);
        const dir = join(await tempDir(), 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: databaseUrl(container, source),
            dir,
            format: 'ts',
            strict: true,
            logger: silentLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toHaveProperty('code', 'UNSUPPORTED_OBJECTS');
        const { message } = error as BaselineError;
        for (const { identity } of expected) {
          expect(message).toMatch(identityPattern(identity));
        }

        for (const reason of new Set(
          expected.map((fallback) => fallback.reason)
        )) {
          expect(message).toContain(reason);
        }

        expect(await migrationFiles(dir)).toEqual([]);
      },
      ROUND_TRIP_TIMEOUT
    );

    it.each(['ts', 'js'] as const)(
      'refuses format %s together with a dump file',
      async (format) => {
        const database = await newDatabase('target');
        const cwd = await tempDir();
        const dump = join(cwd, 'schema.sql');
        await writeFile(dump, 'CREATE TABLE public.t (id integer);\n');
        const dir = join(cwd, 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: databaseUrl(container, database),
            fromFile: dump,
            dir,
            format,
            logger: silentLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        expect(error).toHaveProperty('code', 'INVALID_OPTIONS');
        expect(await migrationFiles(dir)).toEqual([]);
      },
      INTEGRATION_TIMEOUT
    );
  }
);
