var rewire    = require('rewire');
var Migration = rewire('../lib/migration');
var actions   = require('./1414549381268_names');
var sinon     = require('sinon');
var assert    = require('assert');

var migration;

describe('lib/migration', function () {
  var dbMock = {};

  before(function () {
    Migration.__set__({
      'db': dbMock
    });
    migration = new Migration( '1414549381268_names.js', actions);
  });

  describe('self.applyUp', function () {

    it('self.applyUp', function (done) {
      dbMock.query = sinon.stub();
      var next = sinon.stub();
      migration.applyUp(next);
      assert.equal(dbMock.query.calledOnce, true);
      done();
    });
  });

});
