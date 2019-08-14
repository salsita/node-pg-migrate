const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire');

class Client {
  /* eslint-disable */
  constructor() {}

  connect() {}

  query() {}

  end() {}
  /* eslint-enable */
}

/* eslint-disable no-unused-expressions */

const pgMock = {
  Client
};

const Db = proxyquire('../lib/db', { pg: pgMock });

describe('lib/db', () => {
  let sandbox;
  const log = () => null;
  const client = new Client();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('.constructor( connection )', () => {
    let db;
    afterEach(() => {
      if (db) {
        db.close();
      }
    });

    it('pg.Client should be called with connection string', () => {
      sandbox.stub(pgMock, 'Client');
      db = Db('connection_string');
      expect(pgMock.Client).to.be.calledWith('connection_string');
    });

    it('should use external client', () => {
      const mockClient = new pgMock.Client();
      sandbox.stub(mockClient, 'query').returns(Promise.resolve());

      db = Db(mockClient, log);
      return db.query('query').then(() => {
        expect(mockClient.query.getCall(0).args[0]).to.equal('query');
      });
    });
  });

  describe('.query( query )', () => {
    let db;
    beforeEach(() => {
      sandbox.stub(pgMock, 'Client').returns(client);
      sandbox.stub(client, 'connect').returns(Promise.resolve());
      sandbox.stub(client, 'query').returns(Promise.resolve());
      db = Db(undefined, log);
    });
    afterEach(() => {
      db.close();
    });

    it('should call client.connect if this is the first query', () => {
      client.connect.callsFake(fn => fn());
      client.query.returns(Promise.resolve());
      return db.query('query').then(() => {
        expect(client.connect).to.be.calledOnce;
      });
    });
    it('should not call client.connect on subsequent queries', () => {
      client.connect.callsFake(fn => fn());
      client.query.returns(Promise.resolve());
      return db
        .query('query_one')
        .then(() => db.query('query_two'))
        .then(() => {
          expect(client.connect).to.be.calledOnce;
        });
    });
    it('should call client.query with query', () => {
      client.connect.callsFake(fn => fn());
      client.query.returns(Promise.resolve());
      return db.query('query').then(() => {
        expect(client.query.getCall(0).args[0]).to.equal('query');
      });
    });
    it('should not call client.query if client.connect fails', () => {
      const error = 'error';
      client.connect.callsFake(fn => fn(error));
      return expect(db.query('query'))
        .to.eventually.be.rejectedWith(error)
        .then(() => expect(client.query).to.not.been.called);
    });
    it('should resolve promise if query throws no error', () => {
      client.connect.callsFake(fn => fn());
      const result = 'result';
      client.query.returns(Promise.resolve(result));
      return expect(db.query('query')).to.eventually.equal(result);
    });
    it('should reject promise if query throws error', () => {
      client.connect.callsFake(fn => fn());
      const error = 'error';
      client.query.returns(Promise.reject(error));
      return expect(db.query('query')).to.eventually.be.rejectedWith(error);
    });
  });

  describe('.close()', () => {
    let db;
    beforeEach(() => {
      sandbox.stub(pgMock, 'Client').returns(client);
      sandbox.stub(client, 'end').returns(Promise.resolve());
      db = Db();
    });
    afterEach(() => {
      db.close();
    });

    it('should call client.end', () => {
      return db.close().then(() => expect(client.end).to.be.calledOnce);
    });
  });
});
