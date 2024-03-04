import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DBConnection } from '../src/db';
import { getTimestamp, Migration } from '../src/migration';
import type { Logger, RunnerOption } from '../src/types';

const callbackMigration = '1414549381268_names.js';
const promiseMigration = '1414549381268_names_promise.js';
const migrationsTable = 'pgmigrations';

const actionsCallback = require(`./${callbackMigration}`);
const actionsPromise = require(`./${promiseMigration}`);

describe('lib/migration', () => {
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

      expect(getTimestamp(logger, String(now))).toBe(now);
    });

    it('should get timestamp for shortened iso format', () => {
      const now = new Date();

      expect(
        getTimestamp(logger, now.toISOString().replace(/[^\d]/g, ''))
      ).toBe(now.valueOf());
    });
  });

  describe('self.applyUp', () => {
    it('normal operations: db.query should be called', () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      return migration.apply('up').then(() => {
        expect(queryMock).toHaveBeenCalled();
      });
    });

    it('normal operations: db.query should be called when returning promise', () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsPromise,
        options,
        {},
        logger
      );

      return migration.apply('up').then(() => {
        expect(queryMock).toHaveBeenCalled();
      });
    });

    it('--dry-run option: db.query should not be called', () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        {},
        logger
      );

      return migration.apply('up').then(() => {
        expect(queryMock).not.toHaveBeenCalled();
      });
    });

    it('should make proper SQL calls', () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      return migration.apply('up').then(() => {
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

      let error;
      try {
        migration.apply(direction);
      } catch (err) {
        error = err;
      }

      // expecting outside the catch block ensures that the test will fail if the
      // an exception is not caught
      expect(error.toString()).to.include(
        `${invalidMigrationName} exporting a '${direction}' function`
      );
    });
  });

  describe('self.applyDown', () => {
    it('normal operations: db.query should be called', () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      return migration.apply('down').then(() => {
        expect(queryMock).toHaveBeenCalled();
      });
    });

    it('--dry-run option: db.query should not be called', () => {
      const migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        {},
        logger
      );

      return migration.apply('down').then(() => {
        expect(queryMock).not.toHaveBeenCalled();
      });
    });

    it('should make proper SQL calls', () => {
      const migration = new Migration(
        dbMock,
        promiseMigration,
        actionsCallback,
        options,
        {},
        logger
      );

      return migration.apply('down').then(() => {
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
});
