import sinon from 'sinon';
import assert from 'assert';
import Db, { __RewireAPI__ as DbRewireAPI } from '../dist/db';

describe('lib/db', () => {
  let sandbox;
  const pgMock = {};
  let client;

  before(() => {
    DbRewireAPI.__Rewire__('pg', pgMock);
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    client = {
      end: () => null,
    };
    pgMock.Client = sandbox.mock().returns(client);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('.constructor( connection_string )', () => {
    let db;
    afterEach(() => {
      if (db) {
        db.close();
      }
    });

    it('pg.Client should be called with connection_string', () => {
      db = Db('connection_string');
      assert(pgMock.Client.calledWith('connection_string'));
    });
  });

  describe('.query( query, callback )', () => {
    let db;
    beforeEach(() => {
      db = Db();
      client.connect = sandbox.stub();
      client.query = sandbox.stub();
    });
    afterEach(() => {
      db.close();
    });

    it('should call client.connect if this is the first query', () => {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.query('query', () => {
      });
      assert(client.connect.calledOnce);
    });
    it('should not call client.connect on subsequent queries', () => {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.query('query_one', () => {
      });
      db.query('query_two', () => {
      });
      assert(client.connect.calledOnce);
    });
    it('should call client.query with query', () => {
      client.connect.callsArg(0);
      client.query.callsArg(1);
      db.query('query', () => {
      });
      assert(client.query.getCall(0).args[0] === 'query');
    });
    it('should not call client.query if client.connect fails', () => {
      client.connect.callsArgWith(0, 'error');
      const callback = sinon.spy();
      db.query('query', callback);
      sinon.assert.notCalled(client.query);
      assert(callback.calledWith('error'));
    });
    it('should return callback with result if query throws no error', () => {
      client.connect.callsArg(0);
      client.query.callsArgWith(1, null, 'result');
      const callback = sinon.spy();
      db.query('query', callback);
      assert(callback.calledWith(null, 'result'));
    });
    it('should return callback with error if query throws error', () => {
      client.connect.callsArg(0);
      client.query.callsArgWith(1, 'error');
      const callback = sinon.spy();
      db.query('query', callback);
      assert(callback.calledWithExactly('error'));
    });
  });

  describe('.close()', () => {
    let db;
    beforeEach(() => {
      db = Db();
    });
    afterEach(() => {
      db.close();
    });

    it('should call client.end', () => {
      client.end = sinon.spy();
      db.close();
      assert(client.end.calledOnce);
    });
  });
});
