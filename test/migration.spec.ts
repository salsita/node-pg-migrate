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

  const options = { migrationsTable, dir: '' } as RunnerOption;

  let queryMock: Mock;

  beforeEach(() => {
    queryMock = vi.fn();
    dbMock.query = queryMock;
  });

  describe('getTimestamp', () => {
    it('should get timestamp for normal timestamp', () => {
      const now = Date.now();
      const timestamp = String(now);
      expect(getTimestamp(logger, timestamp)).toBe(now);
    });

    it('should get timestamp for shortened iso format', () => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/\D/g, '');
      expect(getTimestamp(logger, timestamp)).toBe(now.valueOf());
    });

    it('should get timestamp for normal timestamp with year prefix', () => {
      const now = Date.now();
      const timestamp = `${new Date(now).getFullYear()}/${now}`;
      expect(getTimestamp(logger, timestamp)).toBe(now);
    });

    it('should get timestamp for shortened iso format with year prefix', () => {
      const now = new Date();
      const timestamp = `${new Date(now).getFullYear()}/${now.toISOString().replace(/\D/g, '')}`;
      expect(getTimestamp(logger, timestamp)).toBe(now.valueOf());
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

  describe('loadMigrationFiles', () => {
    it('should load cockroach migration files', async () => {
      const migrations = await loadMigrationFiles('test/cockroach');
      expect(migrations).toHaveLength(12);
      expect(migrations).toMatchSnapshot();
    });

    it('should load normal migration files', async () => {
      const migrations = await loadMigrationFiles('test/migrations');
      expect(migrations).toHaveLength(90);
      expect(migrations).toMatchSnapshot();
    });

    it('should load migration files from subdirectories', async () => {
      const migrations = await loadMigrationFiles('test/migrations-subdir');
      expect(migrations).toHaveLength(4);
      expect(migrations).toMatchSnapshot();
    });
  });
});
