import { isAbsolute, resolve } from 'node:path';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunnerOption } from '../src';
import type { DBConnection } from '../src/db';
import type { Logger } from '../src/logger';
import {
  FilenameFormat,
  getMigrationFilePaths,
  getNumericPrefix,
  Migration,
} from '../src/migration';

const callbackMigration = '1414549381268_names.js';
const promiseMigration = '1414549381268_names_promise.js';
const reverseMigration = '1739900132875_names_reversed.js';
const migrationsTable = 'pgmigrations';

const actionsCallback = await import(
  /* @vite-ignore */ `./${callbackMigration}`
);
const actionsPromise = await import(/* @vite-ignore */ `./${promiseMigration}`);
const reversePromise = await import(/* @vite-ignore */ `./${reverseMigration}`);

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

  describe('getNumericPrefix', () => {
    it('should get prefix for normal timestamp', () => {
      const now = Date.now();

      expect(getNumericPrefix(String(now), logger)).toBe(now);
    });

    it('should get prefix for shortened iso format', () => {
      const now = new Date();

      expect(
        getNumericPrefix(now.toISOString().replace(/\D/g, ''), logger)
      ).toBe(now.valueOf());
    });

    it('should get prefix for ISO 8601 datetime strings', () => {
      const now = '2025-06-20T12:11:00.000Z';

      expect(getNumericPrefix(now, logger)).toBe(1750421460000);
    });

    it('should get prefix for index strings', () => {
      expect(getNumericPrefix('0001', logger)).toBe(1);
      expect(getNumericPrefix('1234', logger)).toBe(1234);
    });
  });

  describe('getMigrationFilePaths', () => {
    it('should resolve files directly in `dir`', async () => {
      const dir = 'test/migrations';
      const resolvedDir = resolve(dir);
      const filePaths = await getMigrationFilePaths(dir, { logger });

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(94);
      expect(filePaths).not.toContainEqual(expect.stringContaining('nested'));

      for (const filePath of filePaths) {
        expect(filePath).toMatch(resolvedDir);
        expect(filePath).toMatch(/\.js$/);
        expect(isAbsolute(filePath)).toBeTruthy();
      }
    });

    it('should resolve files directly in `dir` and ignore matching ignorePattern', async () => {
      const dir = 'test/migrations';
      // ignores those files that have `test` in their name (not in the path, just filename)
      const ignorePattern = '.+test.+';

      const filePaths = await getMigrationFilePaths(dir, {
        ignorePattern,
        logger,
      });

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(69);

      for (const filePath of filePaths) {
        expect(isAbsolute(filePath)).toBeTruthy();
      }
    });

    it('should resolve files matching `dir` glob (starting from cwd())', async () => {
      const dir = 'test/{cockroach,migrations}/**';

      const filePaths = await getMigrationFilePaths(dir, {
        useGlob: true,
        logger,
      });

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(107);
      expect(filePaths).toContainEqual(expect.stringContaining('nested'));

      for (const filePath of filePaths) {
        expect(isAbsolute(filePath)).toBeTruthy();
      }
    });

    it('should resolve files matching `dir` glob (starting from cwd()) and ignore matching ignorePattern', async () => {
      const dir = 'test/{cockroach,migrations}/**';
      // ignores those files that have `test` in their name (not in the path, just filename)
      const ignorePattern = '*/cockroach/*test*';

      const filePaths = await getMigrationFilePaths(dir, {
        ignorePattern,
        useGlob: true,
        logger,
      });

      expect(Array.isArray(filePaths)).toBeTruthy();
      expect(filePaths).toHaveLength(106);
      expect(filePaths).toContainEqual(expect.stringContaining('nested'));

      for (const filePath of filePaths) {
        expect(isAbsolute(filePath)).toBeTruthy();
      }
    });

    it('should resolve the next index for file paths', async () => {
      const dir = 'test/{cockroach,migrations}/**';
      // ignores those files that have `test` in their name (not in the path, just filename)
      const ignorePattern = '*/cockroach/*test*';

      const nextPrefix = await Migration.getFilePrefix(
        FilenameFormat.index,
        dir,
        ignorePattern
      );

      // There are 106 files matching the pattern
      expect(nextPrefix).toEqual('0107');
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

    it('should perform the inferred reverse operation when reverseMode is enabled', async () => {
      const migration = new Migration(
        dbMock,
        reverseMigration,
        reversePromise,
        options,
        {},
        logger
      );

      await migration.apply('up');

      expect(queryMock).toHaveBeenCalledTimes(4);
      expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN;');
      expect(queryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('DROP TABLE')
      );
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
