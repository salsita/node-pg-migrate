/* eslint-disable no-unused-expressions */
import sinon from 'sinon';
import { expect } from 'chai';
import Migration from '../lib/migration';

const callbackMigration = '1414549381268_names.js';
const promiseMigration = '1414549381268_names_promise.js';
const migrationsTable = 'pgmigrations';

const actionsCallback = require(`./${callbackMigration}`); // eslint-disable-line import/no-dynamic-require
const actionsPromise = require(`./${promiseMigration}`); // eslint-disable-line import/no-dynamic-require

describe('lib/migration', () => {
  const dbMock = {};
  const log = () => null;
  const options = { migrationsTable };
  let migration;

  beforeEach(() => {
    dbMock.query = sinon.spy();
  });

  describe('self.applyUp', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, callbackMigration, actionsCallback, options, log);
      return migration
        .applyUp()
        .then(() => {
          expect(dbMock.query).to.be.called;
        });
    });

    it('normal operations: db.query should be called when returning promise', () => {
      migration = new Migration(dbMock, promiseMigration, actionsPromise, options, log);
      return migration
        .applyUp()
        .then(() => {
          expect(dbMock.query).to.be.called;
        });
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        log
      );
      return migration
        .applyUp()
        .then(() => {
          expect(dbMock.query).to.not.be.called;
        });
    });

    it('should make proper SQL calls', () => {
      migration = new Migration(dbMock, promiseMigration, actionsCallback, options, log);
      return migration
        .applyUp()
        .then(() => {
          expect(dbMock.query).to.have.callCount(2);
          expect(dbMock.query.getCall(0).args[0]).to.include('CREATE TABLE');
          expect(dbMock.query.getCall(1).args[0]).to.include(`INSERT INTO "public"."${migrationsTable}"`);
        });
    });
  });

  describe('self.applyDown', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, callbackMigration, actionsCallback, options, log);
      return migration
        .applyDown()
        .then(() => {
          expect(dbMock.query).to.be.called;
        });
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(
        dbMock,
        callbackMigration,
        actionsCallback,
        { ...options, dryRun: true },
        log
      );
      return migration
        .applyDown()
        .then(() => {
          expect(dbMock.query).to.not.be.called;
        });
    });

    it('should make proper SQL calls', () => {
      migration = new Migration(dbMock, promiseMigration, actionsCallback, options, log);
      return migration
        .applyDown()
        .then(() => {
          expect(dbMock.query).to.have.callCount(2);
          expect(dbMock.query.getCall(0).args[0]).to.include('DROP TABLE');
          expect(dbMock.query.getCall(1).args[0]).to.include(`DELETE FROM "public"."${migrationsTable}"`);
        });
    });
  });
});
