var rewire = require('rewire');
var Migration = rewire('../lib/migration');
var actions = require('./1414549381268_names');
var sinon = require('sinon');
var assert = require('assert');

var migration;

describe('lib/migration', function() {
  var dbMock = {};
  var done;

  before(function() {
    Migration.__set__({
      db: dbMock,
    });
    migration = new Migration('1414549381268_names.js', actions, { migrations_table: 'pgmigrations' });
  });

  beforeEach(function() {
    dbMock.query = sinon.spy();
    done = sinon.mock();
  });

  describe('self.applyUp', function() {
    it('normal operations: db.query should be called', function() {
      migration.applyUp(done);
      assert.equal(dbMock.query.calledOnce, true);
    });

    it('--dry-run option: db.query should not be called', function() {
      global.dryRun = true;
      migration.applyUp(done);
      assert.equal(dbMock.query.called, false);
      global.dryRun = false;
    });
  });

  describe('self.applyDown', function() {
    it('normal operations: db.query should be called', function() {
      migration.applyDown(done);
      assert.equal(dbMock.query.calledOnce, true);
    });

    it('--dry-run option: db.query should not be called', function() {
      global.dryRun = true;
      migration.applyDown(done);
      assert.equal(dbMock.query.called, false);
      global.dryRun = false;
    });
  });
});
