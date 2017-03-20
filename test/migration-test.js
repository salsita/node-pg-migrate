import sinon from 'sinon';
import assert from 'assert';
import actions from './1414549381268_names';
import Migration from '../dist/migration';

describe('lib/migration', () => {
  const dbMock = {};
  let done;
  let migration;

  beforeEach(() => {
    dbMock.query = sinon.spy();
    done = sinon.mock();
  });

  describe('self.applyUp', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions);
      migration.applyUp(done);
      assert.equal(dbMock.query.calledOnce, true);
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions, { dryRun: true });
      migration.applyUp(done);
      assert.equal(dbMock.query.called, false);
    });
  });

  describe('self.applyDown', () => {
    it('normal operations: db.query should be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions);
      migration.applyDown(done);
      assert.equal(dbMock.query.calledOnce, true);
    });

    it('--dry-run option: db.query should not be called', () => {
      migration = new Migration(dbMock, '1414549381268_names.js', actions, { dryRun: true });
      migration.applyDown(done);
      assert.equal(dbMock.query.called, false);
    });
  });
});
