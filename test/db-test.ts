import sinon, { SinonSandbox, SinonStub } from 'sinon'
import { expect } from 'chai'
import proxyquire from 'proxyquire'

class Client {
  /* eslint-disable */
  constructor() {}

  async connect() {}

  async query(...args: any[]) {}

  async end() {}
  /* eslint-enable */
}

/* eslint-disable no-unused-expressions */

const pgMock = {
  Client,
}

const { default: Db } = proxyquire('../src/db', { pg: pgMock })

describe('lib/db', () => {
  let sandbox: SinonSandbox
  const log: typeof console.log = () => null
  const client = new Client()

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('.constructor( connection )', () => {
    let db: typeof Db
    afterEach(() => {
      if (db) {
        db.close()
      }
    })

    it('pg.Client should be called with connection string', () => {
      const mocked = sandbox.stub(pgMock, 'Client').returns(client)
      db = Db('connection_string')
      expect(mocked).to.be.calledWith('connection_string')
    })

    it('should use external client', () => {
      const mockClient = new pgMock.Client()
      const mocked = sandbox.stub(mockClient, 'query').returns(Promise.resolve())

      db = Db(mockClient, log)
      return db.query('query').then(() => {
        expect(mocked.getCall(0).args[0]).to.equal('query')
      })
    })
  })

  describe('.query( query )', () => {
    let db: typeof Db
    let connectMock: SinonStub
    let queryMock: SinonStub
    beforeEach(() => {
      sandbox.stub(pgMock, 'Client').returns(client)
      connectMock = sandbox.stub(client, 'connect').returns(Promise.resolve())
      queryMock = sandbox.stub(client, 'query').returns(Promise.resolve())
      db = Db(undefined, log)
    })
    afterEach(() => {
      db.close()
    })

    it('should call client.connect if this is the first query', () => {
      connectMock.callsFake((fn) => fn())
      queryMock.returns(Promise.resolve())
      return db.query('query').then(() => {
        expect(connectMock).to.be.calledOnce
      })
    })
    it('should not call client.connect on subsequent queries', () => {
      connectMock.callsFake((fn) => fn())
      queryMock.returns(Promise.resolve())
      return db
        .query('query_one')
        .then(() => db.query('query_two'))
        .then(() => {
          expect(connectMock).to.be.calledOnce
        })
    })
    it('should call client.query with query', () => {
      connectMock.callsFake((fn) => fn())
      queryMock.returns(Promise.resolve())
      return db.query('query').then(() => {
        expect(queryMock.getCall(0).args[0]).to.equal('query')
      })
    })
    it('should not call client.query if client.connect fails', () => {
      const error = 'error'
      connectMock.callsFake((fn) => fn(error))
      return expect(db.query('query'))
        .to.eventually.be.rejectedWith(error)
        .then(() => expect(queryMock).to.not.been.called)
    })
    it('should resolve promise if query throws no error', () => {
      connectMock.callsFake((fn) => fn())
      const result = 'result'
      queryMock.returns(Promise.resolve(result))
      return expect(db.query('query')).to.eventually.equal(result)
    })
    it('should reject promise if query throws error', () => {
      connectMock.callsFake((fn) => fn())
      const error = 'error'
      queryMock.returns(Promise.reject(error))
      return expect(db.query('query')).to.eventually.be.rejectedWith(error)
    })
  })

  describe('.close()', () => {
    let db: typeof Db
    beforeEach(() => {
      sandbox.stub(pgMock, 'Client').returns(client)
      sandbox.stub(client, 'end').returns(Promise.resolve())
      db = Db()
    })
    afterEach(() => {
      db.close()
    })

    it('should call client.end', () => {
      return db.close().then(() => expect(client.end).to.be.calledOnce)
    })
  })
})
