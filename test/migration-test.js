import sinon from 'sinon';
import assert from 'assert';
import actions from './1414549381268_names';
import actionsPromise from './1414549381268_names_promise';
import Migration from '../lib/migration';

describe('lib/migration', () => {
  const dbMock = {};
  let migration;

  beforeEach(() => {
    dbMock.query = sinon.spy();
  });

  describe('self.applyUp', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions);
      return migration
        .applyUp()
        .then(() => {
          assert.equal(dbMock.query.called, true);
        });
    });

    it('normal operations: db.query should be called when returning promise', () => {
      migration = new Migration(dbMock, '1414549381268_names_promise.js', actionsPromise);
      return migration
        .applyUp()
        .then(() => {
          assert.equal(dbMock.query.called, true);
        });
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions, { dryRun: true });
      return migration
        .applyUp()
        .then(() => {
          assert.equal(dbMock.query.called, false);
        });
    });
  });

  describe('self.applyDown', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions);
      return migration
        .applyDown()
        .then(() => {
          assert.equal(dbMock.query.called, true);
        });
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions, { dryRun: true });
      return migration
        .applyDown()
        .then(() => {
          assert.equal(dbMock.query.called, false);
        });
    });
  });
});
