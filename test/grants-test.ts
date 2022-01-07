import { expect } from 'chai'
import * as Grants from '../src/operations/grants'
import { options1 } from './utils'

type GrantRolesParameters = Parameters<ReturnType<typeof Grants.grantRoles>>
type GrantOnTablesParameters = Parameters<ReturnType<typeof Grants.grantOnTables>>

describe('lib/operations/grants', () => {
  describe('.grantRoles', () => {
    it('grants correct roles', () => {
      const args: GrantRolesParameters = ['role1', 'role2']
      const sql = Grants.grantRoles(options1)(...args)
      expect(sql).to.equal(`GRANT "role1" TO "role2";`)
    })
  })

  describe('.grantOnTables', () => {
    it('grants correctly a single privelege', () => {
      const args: GrantOnTablesParameters = [
        {
          privileges: 'INSERT',
          tables: 'table1',
          roles: 'role1',
          withGrantOption: true,
        },
      ]

      const sql = Grants.grantOnTables(options1)(...args)
      expect(sql).to.equal(`GRANT INSERT ON "table1" TO "role1" WITH GRANT OPTION;`)
    })

    it('grants correctly for array options', () => {
      const args: GrantOnTablesParameters = [
        {
          privileges: ['INSERT', 'DELETE'],
          tables: ['table1', 'table2'],
          roles: ['role1', 'role2'],
        },
      ]

      const sql = Grants.grantOnTables(options1)(...args)
      expect(sql).to.equal(`GRANT INSERT,DELETE ON "table1","table2" TO "role1","role2";`)
    })

    it('grants correctly all tables in schema', () => {
      const args: GrantOnTablesParameters = [
        {
          privileges: 'ALL',
          tables: 'ALL',
          schema: 'schema1',
          roles: 'role1',
        },
      ]

      const sql = Grants.grantOnTables(options1)(...args)
      expect(sql).to.equal(`GRANT ALL ON ALL TABLES IN SCHEMA "schema1" TO "role1";`)
    })
  })
})
