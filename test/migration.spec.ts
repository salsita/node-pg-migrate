import { resolve } from 'node:path';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DBConnection } from '../src/db';
import { getTimestamp, loadMigrationFiles, Migration } from '../src/migration';
import type { Logger, RunnerOption } from '../src/types';

const callbackMigration = '1414549381268_names.js';
const promiseMigration = '1414549381268_names_promise.js';
const migrationsTable = 'pgmigrations';

const actionsCallback = require(`./${callbackMigration}`);
const actionsPromise = require(`./${promiseMigration}`);

describe('migration', () => {
  const dbMock = {} as DBConnection;

  const logger: Logger = {
    info: () => null,
    warn: () => null,
    error: () => null,
  };

  const options = { migrationsTable } as RunnerOption;

  let queryMock: Mock;

  beforeEach(() => {
    queryMock = vi.fn();
    dbMock.query = queryMock;
  });

  describe('getTimestamp', () => {
    it('should get timestamp for normal timestamp', () => {
      const now = Date.now();

      expect(getTimestamp(String(now), logger)).toBe(now);
    });

    it('should get timestamp for shortened iso format', () => {
      const now = new Date();

      expect(getTimestamp(now.toISOString().replace(/\D/g, ''), logger)).toBe(
        now.valueOf()
      );
    });
  });

  describe('loadMigrationFiles', () => {
    it('should resolve files directly in `dir`', async () => {
      const dir = 'test/migrations';
      const resolvedDir = resolve(dir);
      const filePaths = await loadMigrationFiles(
        dir,
        undefined,
        undefined,
        logger
      );

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(91);
      expect(filePaths).not.toContainEqual(expect.stringContaining('nested'));

      for (const filePath of filePaths) {
        expect(filePath).toMatch(resolvedDir);
        expect(filePath).toMatch(/\.js$/);
      }
    });

    it('should resolve files directly in `dir` and ignore matching ignorePattern', async () => {
      const dir = 'test/migrations';
      // ignores those files that have `test` in their name (not in the path, just filename)
      const ignorePattern = '.+test.+';

      const filePaths = await loadMigrationFiles(
        dir,
        ignorePattern,
        undefined,
        logger
      );

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(66);
    });

    it('should resolve files matching `dir` glob (starting from cwd())', async () => {
      const dir = 'test/{cockroach,migrations}/**';

      const filePaths = await loadMigrationFiles(dir, undefined, true, logger);

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(104);
      expect(filePaths).toContainEqual(expect.stringContaining('nested'));
    });

    it('should resolve files matching `dir` glob (starting from cwd()) and ignore matching ignorePattern', async () => {
      const dir = 'test/{cockroach,migrations}/**';
      // ignores those files that have `test` in their name (not in the path, just filename)
      const ignorePattern = '*/cockroach/*test*';

      const filePaths = await loadMigrationFiles(
        dir,
        ignorePattern,
        true,
        logger
      );

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(103);
      expect(filePaths).toContainEqual(expect.stringContaining('nested'));
    });
  });

  describe('self.applyUp', () => {
    it('should call db.query on normal operations', async () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      await migration.apply('up');

      expect(queryMock).toHaveBeenCalled();
    });

    it('should call db.query when returning promise on normal operations', async () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsPromise,
        options,
        {},
        logger
      );

      await migration.apply('up');

      expect(queryMock).toHaveBeenCalled();
    });

    it('should not call db.query on --dry-run', async () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        {},
        logger
      );

      await migration.apply('up');

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('should make proper SQL calls', async () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      await migration.apply('up');

      expect(queryMock).toHaveBeenCalledTimes(4);
      expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN;');
      expect(queryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('CREATE TABLE')
      );
      expect(queryMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(`INSERT INTO "public"."${migrationsTable}"`)
      );
      expect(queryMock).toHaveBeenNthCalledWith(4, 'COMMIT;');
    });

    it('should fail with an error message if the migration is invalid', () => {
      const invalidMigrationName = 'invalid-migration';

      const migration = new Migration(
        dbMock,
        invalidMigrationName,
        {},
        options,
        {},
        logger
      );

      const direction = 'up';

      expect(() => migration.apply(direction)).toThrow(
        new Error(
          `Unknown value for direction: ${direction}. Is the migration ${invalidMigrationName} exporting a '${direction}' function?`
        )
      );
    });
  });

  describe('self.applyDown', () => {
    it('should call db.query on normal operations', async () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      await migration.apply('down');

      expect(queryMock).toHaveBeenCalled();
    });

    it('should not call db.query on --dry-run', async () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        {},
        logger
      );

      await migration.apply('down');

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('should make proper SQL calls', async () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      await migration.apply('down');

      expect(queryMock).toHaveBeenCalledTimes(4);
      expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN;');
      expect(queryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('DROP TABLE')
      );
      expect(queryMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(`DELETE FROM "public"."${migrationsTable}"`)
      );
      expect(queryMock).toHaveBeenNthCalledWith(4, 'COMMIT;');
    });
  });
});
