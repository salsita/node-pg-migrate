import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline } from '../../../src';
import type { BaselineResult } from '../../../src';
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
  migrateUp,
  nextMigrationName,
  pgDumpFile,
  queryRows,
  recordingLogger,
  workDir,
  writeSqlMigration,
} from './helpers';

/**
 * A baseline migration and the directory it was written to.
 */
interface WrittenBaseline {
  readonly result: BaselineResult;
  readonly dir: string;
}

describe.each(PG_VERSIONS)(
  'baseline() migrations run by the runner (PG %s)',
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

    /**
     * Creates a database with Chinook in it (tables with a few rows each).
     *
     * @param name The name of the new database.
     */
    async function chinookDatabase(name: string): Promise<void> {
      await createDatabase(container, name);
      await loadFixture(container, name, 'chinook');
    }

    /**
     * Writes the baseline of a database from its pg_dump file, into a new
     * migrations directory.
     *
     * @param source The database.
     *
     * @returns The baseline and its directory.
     */
    async function baselineOf(source: string): Promise<WrittenBaseline> {
      const work = await workDir();
      const fromFile = join(work, `${source}.sql`);
      await pgDumpFile(container, source, fromFile);
      const dir = join(work, 'migrations');

      const result = await baseline({
        databaseUrl: databaseUrl(container, source),
        fromFile,
        dir,
        logger: recordingLogger(),
      });

      return { result, dir };
    }

    it('restores the session settings for the migrations after it in the same transaction', async () => {
      await chinookDatabase('settings_source');
      const { result, dir } = await baselineOf('settings_source');
      const followUp = nextMigrationName(
        result.migrationName,
        'record-settings'
      );
      // Unqualified on purpose: it only works with a usable search path.
      await writeSqlMigration(dir, followUp, [
        'CREATE TABLE recorded_settings (search_path text, check_function_bodies text, lock_timeout text);',
        "INSERT INTO recorded_settings VALUES (current_setting('search_path'), current_setting('check_function_bodies'), current_setting('lock_timeout'));",
      ]);
      await createDatabase(container, 'settings_blank');
      await loadSql(
        container,
        container.getDatabase(),
        "ALTER DATABASE settings_blank SET lock_timeout = '5s';"
      );

      // The runner sets the search path to "public", then runs both
      // migrations in one transaction.
      const ran = await migrateUp(
        databaseUrl(container, 'settings_blank'),
        dir,
        { schema: 'public' }
      );

      expect(ran.map(({ name }) => name)).toEqual([
        result.migrationName,
        followUp,
      ]);
      expect(
        await queryRows(
          container,
          'settings_blank',
          'SELECT search_path, check_function_bodies, lock_timeout FROM public.recorded_settings'
        )
      ).toEqual(['public|on|5s']);
    });

    it('fails and rolls back on the database it was made from, keeping its rows', async () => {
      await chinookDatabase('safe_source');
      await loadSql(
        container,
        'safe_source',
        "INSERT INTO public.artist (name) VALUES ('Still here');"
      );
      const { dir } = await baselineOf('safe_source');
      const schemaBefore = await dumpSchema(container, 'safe_source');

      await expect(
        migrateUp(databaseUrl(container, 'safe_source'), dir)
      ).rejects.toThrow(/already exists/);

      expect(
        await queryRows(
          container,
          'safe_source',
          "SELECT name FROM public.artist WHERE name = 'Still here'"
        )
      ).toEqual(['Still here']);
      expect(
        await queryRows(
          container,
          'safe_source',
          'SELECT count(*) FROM public.pgmigrations'
        )
      ).toEqual(['0']);
      expect(await dumpSchema(container, 'safe_source')).toBe(schemaBefore);
    });

    it('is recorded with --fake on the database it was made from, and only later migrations run there', async () => {
      await chinookDatabase('fake_source');
      const { result, dir } = await baselineOf('fake_source');
      const url = databaseUrl(container, 'fake_source');

      const faked = await migrateUp(url, dir, {
        fake: true,
        file: result.migrationName,
      });

      expect(faked.map(({ name }) => name)).toEqual([result.migrationName]);
      expect(
        await queryRows(
          container,
          'fake_source',
          'SELECT name FROM public.pgmigrations'
        )
      ).toEqual([result.migrationName]);

      const followUp = nextMigrationName(
        result.migrationName,
        'add-artist-country'
      );
      await writeSqlMigration(dir, followUp, [
        'ALTER TABLE artist ADD COLUMN country text;',
      ]);

      const ran = await migrateUp(url, dir);

      expect(ran.map(({ name }) => name)).toEqual([followUp]);
      expect(
        await queryRows(
          container,
          'fake_source',
          'SELECT name FROM public.pgmigrations ORDER BY id'
        )
      ).toEqual([result.migrationName, followUp]);
      expect(
        await queryRows(
          container,
          'fake_source',
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artist' AND column_name = 'country'"
        )
      ).toEqual(['country']);
    });
  }
);
