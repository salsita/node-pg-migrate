import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { basename, join } from 'node:path';
import type { ClientBase } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline, BaselineError } from '../../../src';
import type { BaselineOptions } from '../../../src';
import { adversarialPath } from '../../baseline/helpers';
import {
  createDatabase,
  databaseUrl,
  INTEGRATION_TIMEOUT,
  loadSql,
  PG_VERSIONS,
  setupPostgresDatabase,
} from '../utils';
import {
  listFiles,
  migrateUp,
  pgDumpArchiveFile,
  pgDumpFile,
  pgDumpShimForTest,
  recordingLogger,
  rejectionOf,
  workDir,
  writeSqlMigration,
} from './helpers';

/**
 * A connection URL nobody listens on, so connecting to it fails right away.
 */
const UNREACHABLE_DATABASE_URL = 'postgres://nobody:secret@127.0.0.1:1/nowhere';

/**
 * A client that fails every query, for options that must be refused before
 * any query runs.
 */
const UNUSABLE_CLIENT = {
  query: () => Promise.reject(new Error('the dbClient must not be used')),
} as unknown as ClientBase;

describe('baseline() refusals before any database work', () => {
  it('refuses a migrations directory that already has a migration (MIGRATIONS_EXIST)', async () => {
    const dir = await workDir();
    await writeSqlMigration(dir, '1_existing', ['SELECT 1;']);

    // Neither the database nor the dump can be read: the directory comes first.
    const error = await rejectionOf(
      baseline({
        databaseUrl: UNREACHABLE_DATABASE_URL,
        fromFile: '/does/not/exist.sql',
        dir,
        logger: recordingLogger(),
      })
    );

    expect(error).toBeInstanceOf(BaselineError);
    const { code, message } = error as BaselineError;
    expect(code).toBe('MIGRATIONS_EXIST');
    expect(message).toContain(basename(dir));
    expect(message).toContain('already has 1 file');
    expect(await listFiles(dir)).toEqual(['1_existing.sql']);
  });

  it.each([
    [
      'without a dump file or a connection',
      (): Partial<BaselineOptions> => ({}),
    ],
    [
      'with both databaseUrl and dbClient',
      (): Partial<BaselineOptions> => ({
        databaseUrl: UNREACHABLE_DATABASE_URL,
        dbClient: UNUSABLE_CLIENT,
        fromFile: '/does/not/exist.sql',
      }),
    ],
    [
      'with an empty name',
      (): Partial<BaselineOptions> => ({
        fromFile: '/does/not/exist.sql',
        name: '',
      }),
    ],
  ])('refuses options %s (INVALID_OPTIONS)', async (_, options) => {
    const dir = join(await workDir(), 'migrations');

    const error = await rejectionOf(
      baseline({ ...options(), dir, logger: recordingLogger() })
    );

    expect(error).toBeInstanceOf(BaselineError);
    expect((error as BaselineError).code).toBe('INVALID_OPTIONS');
    expect(await listFiles(dir)).toEqual([]);
  });

  it.each(['custom-format.dump', 'tar-format.tar'])(
    'refuses the pg_dump archive %s instead of writing its bytes (BINARY_DUMP)',
    async (file) => {
      const dir = join(await workDir(), 'migrations');

      const error = await rejectionOf(
        baseline({
          fromFile: adversarialPath(file),
          dir,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      const { code, message } = error as BaselineError;
      expect(code).toBe('BINARY_DUMP');
      expect(message).toContain('pg_restore');
      expect(await listFiles(dir)).toEqual([]);
    }
  );
});

describe.each(PG_VERSIONS)(
  'baseline() refusals (PG %s)',
  { timeout: INTEGRATION_TIMEOUT },
  (postgresVersion) => {
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
      container = await setupPostgresDatabase(
        `postgres:${postgresVersion}-alpine`
      );
    }, INTEGRATION_TIMEOUT);

    afterAll(async () => {
      await container?.stop();
    });

    it.each(['a pg_dump file', 'pg_dump'] as const)(
      'refuses a database whose migrations table records migrations, with %s (HISTORY_EXISTS)',
      async (route) => {
        const database = `history_${route.replaceAll(' ', '_')}`;
        await createDatabase(container, database);
        const history = await workDir();
        await writeSqlMigration(history, '1_first', [
          'CREATE TABLE first_table (id integer PRIMARY KEY);',
        ]);
        await migrateUp(databaseUrl(container, database), history);
        const work = await workDir();
        const fromFile = join(work, 'dump.sql');
        await pgDumpFile(container, database, fromFile);
        const source: Partial<BaselineOptions> =
          route === 'pg_dump'
            ? { pgDump: await pgDumpShimForTest(container) }
            : { fromFile };
        const dir = join(work, 'migrations');

        const error = await rejectionOf(
          baseline({
            ...source,
            databaseUrl: databaseUrl(container, database),
            dir,
            logger: recordingLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        const { code, message } = error as BaselineError;
        expect(code).toBe('HISTORY_EXISTS');
        expect(message).toContain('"public"."pgmigrations"');
        expect(message).toContain('already records 1 migration');
        expect(await listFiles(dir)).toEqual([]);
      }
    );

    it('looks for the history in the first schema it is given (HISTORY_EXISTS)', async () => {
      const database = 'history_app_schema';
      await createDatabase(container, database);
      await loadSql(container, database, 'CREATE SCHEMA app;');
      const history = await workDir();
      await writeSqlMigration(history, '1_first', [
        'CREATE TABLE first_table (id integer PRIMARY KEY);',
      ]);
      // The runner keeps its table in the schema it runs in.
      await migrateUp(databaseUrl(container, database), history, {
        schema: 'app',
      });
      const work = await workDir();
      const fromFile = join(work, 'dump.sql');
      await pgDumpFile(container, database, fromFile);
      const dir = join(work, 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: databaseUrl(container, database),
          fromFile,
          dir,
          schema: ['app', 'public'],
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      const { code, message } = error as BaselineError;
      expect(code).toBe('HISTORY_EXISTS');
      expect(message).toContain('"app"."pgmigrations"');
      expect(await listFiles(dir)).toEqual([]);
    });

    it('refuses a dump that creates the migrations table (MIGRATIONS_TABLE_IN_DUMP)', async () => {
      const database = 'table_in_dump';
      await createDatabase(container, database);
      await loadSql(
        container,
        database,
        'CREATE TABLE public.widgets (id integer PRIMARY KEY, name text NOT NULL);'
      );
      // The runner creates its table, but nothing is recorded in it.
      await migrateUp(databaseUrl(container, database), await workDir());
      const work = await workDir();
      const fromFile = join(work, 'dump.sql');
      const dump = await pgDumpFile(container, database, fromFile);
      expect(dump).toContain('CREATE TABLE public.pgmigrations');
      const dir = join(work, 'migrations');

      const error = await rejectionOf(
        baseline({
          databaseUrl: databaseUrl(container, database),
          fromFile,
          dir,
          logger: recordingLogger(),
        })
      );

      expect(error).toBeInstanceOf(BaselineError);
      const { code, message } = error as BaselineError;
      expect(code).toBe('MIGRATIONS_TABLE_IN_DUMP');
      expect(message).toContain('pgmigrations');
      expect(message).toMatch(/exclude/i);
      expect(await listFiles(dir)).toEqual([]);
    });

    it.each(['custom', 'tar'] as const)(
      'refuses a %s-format archive of this pg_dump (BINARY_DUMP)',
      async (format) => {
        const database = `archive_${format}`;
        await createDatabase(container, database);
        await loadSql(
          container,
          database,
          'CREATE TABLE public.widgets (id integer PRIMARY KEY, name text NOT NULL);'
        );
        const work = await workDir();
        const fromFile = join(work, `schema.${format}`);
        await pgDumpArchiveFile(container, database, format, fromFile);
        const dir = join(work, 'migrations');

        const error = await rejectionOf(
          baseline({
            databaseUrl: databaseUrl(container, database),
            fromFile,
            dir,
            logger: recordingLogger(),
          })
        );

        expect(error).toBeInstanceOf(BaselineError);
        const { code, message } = error as BaselineError;
        expect(code).toBe('BINARY_DUMP');
        expect(message).toContain(`${format}-format`);
        expect(message).toContain('pg_restore');
        expect(await listFiles(dir)).toEqual([]);
      }
    );
  }
);
