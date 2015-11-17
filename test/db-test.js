var rewire = require('rewire');
var db     = rewire('../lib/db');
var sinon  = require('sinon');
var assert = require('assert');

describe('lib/db', function () {
  var sandbox;
  var pgMock = {};
  var client;
  var client_active_mock;

  before(function () {
    db.__set__('pg', pgMock);
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    client  = {};
    pgMock.Client = sandbox.mock().returns(client);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('.init( connection_string )', function () {
    before(function () {
      process.env.DATABASE_URL = 'database_url';
    });
    it('pg.Client should be called with connection_string', function () {
      db.init('connection_string');
      assert(pgMock.Client.calledWith('connection_string'));
    });
    it('pg.Client should be called with process.env.DATABASE_URLif no args passed', function () {
      db.init();
      assert(pgMock.Client.calledWith('database_url'));
    });
  });

  describe('.query( query, callback )', function () {
    beforeEach(function () {
      db.__set__('client_active', false);
      client.connect = sandbox.stub();
      client.query   = sandbox.stub();
    });
    it('should call client.connect if this is the first query', function () {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.init();
      db.query('query', function () {});
      assert(client.connect.calledOnce);
    });
    it('should not call client.connect on subsequent queries', function () {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.init();
      db.query('query_one', function () {});
      db.query('query_two', function () {});
      assert(client.connect.calledOnce);
    });
    it('should call client.query with query', function () {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.init();
      db.query('query', function () {});
      assert(client.query.getCall(0).args[0] === 'query');
    });
    it('should not call client.query if client.connect fails', function () {
      db.init();
      client.connect.callsArgWith(0, 'error');
      var callback = sinon.spy();
      db.query('query', callback);
      sinon.assert.notCalled(client.query);
      assert(callback.calledWith('error'));
    });
    it('should return callback with result if query throws no error', function () {
      client.connect.callsArg(0);
      client.query.callsArgWith(1, null, 'result');
      var callback = sinon.spy();
      db.init();
      db.query('query', callback);
      assert(callback.calledWith(null, 'result'));
    });
    it('should return callback with error if query throws error', function () {
      client.connect.callsArg(0);
      client.query.callsArgWith(1, 'error', 'something');
      var callback = sinon.spy();
      db.init();
      db.query('query', callback);
      assert(callback.calledWithExactly('error'));
    });
  });

  describe('.close()', function () {
    it('should call client.end', function () {
      client.end = sinon.spy();
      db.init();
      db.close();
      assert(client.end.calledOnce);
    });
  });
      
});
