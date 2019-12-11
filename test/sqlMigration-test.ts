import sinon from 'sinon'
import { expect } from 'chai'
import { getActions } from '../src/sqlMigration'

/* eslint-disable no-unused-expressions */

describe('lib/sqlMigration', () => {
  describe('getActions', () => {
    it('without comments', () => {
      const content = 'SELECT 1 FROM something'
      const { up, down } = getActions(content)
      expect(up).to.exist
      expect(down).to.be.false

      const sql = sinon.spy()
      expect(up({ sql })).to.not.exist
      expect(sql.called).to.be.true
      expect(sql.lastCall.args[0].trim()).to.eql(content.trim())
    })

    it('with up comment', () => {
      const content = `
-- Up Migration
SELECT 1 FROM something
`
      const { up, down } = getActions(content)
      expect(up).to.exist
      expect(down).to.be.false

      const sql = sinon.spy()
      expect(up({ sql })).to.not.exist
      expect(sql.called).to.be.true
      expect(sql.lastCall.args[0].trim()).to.eql(content.trim())
    })

    it('with both comments', () => {
      const upMigration = `
-- Up Migration
SELECT 1 FROM something`
      const downMigration = `
-- Down Migration
SELECT 2 FROM something`
      const content = `${upMigration}${downMigration}`
      const { up, down } = getActions(content)
      expect(up).to.exist
      expect(down).to.exist

      const upSql = sinon.spy()
      expect(up({ sql: upSql })).to.not.exist
      expect(upSql.called).to.be.true
      expect(upSql.lastCall.args[0].trim()).to.eql(upMigration.trim())

      const downSql = sinon.spy()
      expect(down({ sql: downSql })).to.not.exist
      expect(downSql.called).to.be.true
      expect(downSql.lastCall.args[0].trim()).to.eql(downMigration.trim())
    })

    it('with both comments in reverse order', () => {
      const upMigration = `
-- Up Migration
SELECT 1 FROM something`
      const downMigration = `
-- Down Migration
SELECT 2 FROM something`
      const content = `${downMigration}${upMigration}`
      const { up, down } = getActions(content)
      expect(up).to.exist
      expect(down).to.exist

      const upSql = sinon.spy()
      expect(up({ sql: upSql })).to.not.exist
      expect(upSql.called).to.be.true
      expect(upSql.lastCall.args[0].trim()).to.eql(upMigration.trim())

      const downSql = sinon.spy()
      expect(down({ sql: downSql })).to.not.exist
      expect(downSql.called).to.be.true
      expect(downSql.lastCall.args[0].trim()).to.eql(downMigration.trim())
    })

    it('with both comments with some chars added', () => {
      const upMigration = `
 -- - up Migration to do Up migration
SELECT 1 FROM something`
      const downMigration = `
  -- -- -- Down    migration to bring DB down
SELECT 2 FROM something`
      const content = `${upMigration}${downMigration}`
      const { up, down } = getActions(content)
      expect(up).to.exist
      expect(down).to.exist

      const upSql = sinon.spy()
      expect(up({ sql: upSql })).to.not.exist
      expect(upSql.called).to.be.true
      expect(upSql.lastCall.args[0].trim()).to.eql(upMigration.trim())

      const downSql = sinon.spy()
      expect(down({ sql: downSql })).to.not.exist
      expect(downSql.called).to.be.true
      expect(downSql.lastCall.args[0].trim()).to.eql(downMigration.trim())
    })
  })
})
