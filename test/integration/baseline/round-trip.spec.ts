import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseline } from '../../../src';
import type { BaselineResult } from '../../../src';
import type { SchemaFixture } from '../utils';
import {
  createDatabase,
  databaseUrl,
  dumpSchema,
  INTEGRATION_TIMEOUT,
  loadFixture,
  loadSql,
  PG_VERSIONS,
  SCHEMA_FIXTURES,
  setupPostgresDatabase,
} from '../utils';
import {
  containerPgDumpVersion,
  dumpedVersion,
  migrateUp,
  pgDumpFile,
  pgDumpShimForTest,
  recordingLogger,
  serverVersion,
  workDir,
} from './helpers';

describe.each(PG_VERSIONS)(
  'baseline() round trip (PG %s)',
  // Each test loads a fixture, dumps it and rebuilds it, which takes a few
  // seconds for Pagila, and several times that while other files run.
  { timeout: INTEGRATION_TIMEOUT * 2 },
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
     * Creates the database a baseline is made from: a new one with a fixture.
     *
     * @param name The name of the new database.
     * @param fixture The fixture to load into it.
     *
     * @returns The name of the database.
     */
    async function sourceDatabase(
      name: string,
      fixture: SchemaFixture
    ): Promise<string> {
      await createDatabase(container, name);
      await loadFixture(container, name, fixture);

      return name;
    }

    /**
     * Checks that `baseline()` wrote exactly one migration, where its result
     * says, for a schema small enough for the default lock table.
     *
     * @param result What `baseline()` returned.
     * @param dir The migrations directory it was given.
     */
    async function expectOneBaselineFile(
      result: BaselineResult,
      dir: string
    ): Promise<void> {
      expect(result.migrationName).toMatch(/^\d+_baseline$/);
      expect(result.path).toBe(join(dir, `${result.migrationName}.sql`));
      expect(await readdir(dir)).toEqual([basename(result.path)]);
      expect(result.relations).toBeGreaterThan(0);
      expect(result.requiredMaxLocksPerTransaction).toBeUndefined();
    }

    /**
     * Runs the baseline on a new blank database with the runner, and checks
     * that the blank database ends up with the schema of the source.
     *
     * @param source The database the baseline was made from.
     * @param result What `baseline()` returned.
     * @param dir The migrations directory.
     */
    async function expectRebuilt(
      source: string,
      result: BaselineResult,
      dir: string
    ): Promise<void> {
      const blank = `${source}_rebuilt`;
      await createDatabase(container, blank);

      const ran = await migrateUp(databaseUrl(container, blank), dir);

      expect(ran.map(({ name }) => name)).toEqual([result.migrationName]);
      expect(await dumpSchema(container, blank)).toBe(
        await dumpSchema(container, source)
      );
    }

    it.each(SCHEMA_FIXTURES)(
      'rebuilds %s from a pg_dump file',
      async (fixture) => {
        const source = await sourceDatabase(
          `from_file_${fixture.replaceAll('-', '_')}`,
          fixture
        );
        const work = await workDir();
        const fromFile = join(work, `${fixture}.sql`);
        const dump = await pgDumpFile(container, source, fromFile);
        const dir = join(work, 'migrations');
        const logger = recordingLogger();

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          fromFile,
          dir,
          logger,
        });

        await expectOneBaselineFile(result, dir);
        // Nothing in the directory needs quoting for a shell.
        expect(dir).toMatch(/^[\w./-]+$/);
        expect(result.fakeCommand).toBe(
          `node-pg-migrate up ${result.migrationName} --fake -m ${dir}`
        );
        expect(result.source).toEqual({
          serverVersion: dumpedVersion(dump, 'Dumped from database version'),
          pgDumpVersion: dumpedVersion(dump, 'Dumped by pg_dump version'),
          file: `${fixture}.sql`,
        });
        expect(logger.messages.info).toEqual([
          `> Wrote ${relative(process.cwd(), result.path)}`,
          '> On databases that already have this schema, record it without running it:',
          `>   ${result.fakeCommand}`,
          '> Blank databases run it with a normal `node-pg-migrate up`.',
        ]);
        expect(logger.messages.warn).toEqual(
          result.warnings.map((warning) => `> Warning: ${warning}`)
        );
        await expectRebuilt(source, result, dir);
      }
    );

    it.each(SCHEMA_FIXTURES)(
      'rebuilds %s by running pg_dump',
      async (fixture) => {
        const source = await sourceDatabase(
          `pg_dump_${fixture.replaceAll('-', '_')}`,
          fixture
        );
        const dir = join(await workDir(), 'migrations');

        const result = await baseline({
          databaseUrl: databaseUrl(container, source),
          dir,
          pgDump: await pgDumpShimForTest(container),
          logger: recordingLogger(),
        });

        await expectOneBaselineFile(result, dir);
        expect(result.fakeCommand).toBe(
          `node-pg-migrate up ${result.migrationName} --fake -m ${dir}`
        );
        expect(result.source).toEqual({
          serverVersion: await serverVersion(container),
          pgDumpVersion: await containerPgDumpVersion(container),
        });
        await expectRebuilt(source, result, dir);
      }
    );

    it.each([
      ['includeSchemas', { includeSchemas: ['kitchen', 'kitchen_audit'] }],
      ['excludeSchemas', { excludeSchemas: ['Sink Área'] }],
    ] as const)(
      'rebuilds the kitchen-sink schemas picked with %s, extensions included',
      async (option, schemas) => {
        const source = await sourceDatabase(
          `picked_with_${option.toLowerCase()}`,
          'kitchen-sink'
        );
        const dir = join(await workDir(), 'migrations');

        const result = await baseline({
          ...schemas,
          databaseUrl: databaseUrl(container, source),
          dir,
          pgDump: await pgDumpShimForTest(container),
          logger: recordingLogger(),
        });

        await expectOneBaselineFile(result, dir);
        // Only "Sink Área" is left out, and nothing else depends on it.
        await loadSql(container, source, 'DROP SCHEMA "Sink Área" CASCADE;');
        await expectRebuilt(source, result, dir);
      }
    );

    it('rebuilds chinook from a pg_dump file without a database connection', async () => {
      const source = await sourceDatabase('without_connection', 'chinook');
      const work = await workDir();
      const fromFile = join(work, 'chinook.sql');
      const dump = await pgDumpFile(container, source, fromFile);
      // A shell would split this directory at the space.
      const dir = join(work, 'db migrations');

      const result = await baseline({
        fromFile,
        dir,
        logger: recordingLogger(),
      });

      await expectOneBaselineFile(result, dir);
      expect(dir).not.toContain("'");
      expect(result.fakeCommand).toBe(
        `node-pg-migrate up ${result.migrationName} --fake -m '${dir}'`
      );
      expect(result.source).toEqual({
        serverVersion: dumpedVersion(dump, 'Dumped from database version'),
        pgDumpVersion: dumpedVersion(dump, 'Dumped by pg_dump version'),
        file: 'chinook.sql',
      });
      await expectRebuilt(source, result, dir);
    });
  }
);
