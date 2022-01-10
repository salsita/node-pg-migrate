import { expect } from 'chai'
import * as Grants from '../src/operations/grants'
import { options1 } from './utils'

type GrantRolesParameters = Parameters<ReturnType<typeof Grants.grantRoles>>
type RevokeRolesParameters = Parameters<ReturnType<typeof Grants.revokeRoles>>
type GrantOnTablesParameters = Parameters<ReturnType<typeof Grants.grantOnTables>>
type RevokeOnTablesParameters = Parameters<ReturnType<typeof Grants.revokeOnTables>>
type GrantOnSchemasParameters = Parameters<ReturnType<typeof Grants.grantOnSchemas>>
type RevokeOnSchemasParameters = Parameters<ReturnType<typeof Grants.revokeOnSchemas>>

describe('lib/operations/grants', () => {
  describe('.grantRoles', () => {
    it('grants correct roles', () => {
      const args: GrantRolesParameters = ['role1', 'role2']
      const sql = Grants.grantRoles(options1)(...args)
      expect(sql).to.equal(`GRANT "role1" TO "role2";`)
    })
  })

  describe('.revokeRoles', () => {
    it('revokes roles correctly', () => {
      const args: RevokeRolesParameters = ['role1', 'role2']
      const sql = Grants.revokeRoles(options1)(...args)
      expect(sql).to.equal(`REVOKE "role1" FROM "role2";`)
    })

    it('correctly applies options CASCADE, ADMIN OPTION', () => {
      const args: RevokeRolesParameters = [
        ['role1', 'role2'],
        ['role3', 'role4'],
        {
          onlyAdminOption: true,
          cascade: true,
        },
      ]
      const sql = Grants.revokeRoles(options1)(...args)
      expect(sql).to.equal(`REVOKE ADMIN OPTION FOR "role1","role2" FROM "role3","role4" CASCADE;`)
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

  describe('.revokeOnTables', () => {
    it('revokes privileges from tables', () => {
      const args: RevokeOnTablesParameters = [
        {
          privileges: ['DELETE', 'INSERT'],
          tables: ['table1'],
          roles: ['role1', 'role2'],
        },
      ]
      const sql = Grants.revokeOnTables(options1)(...args)
      expect(sql).to.equal(`REVOKE DELETE,INSERT ON "table1" FROM "role1","role2";`)
    })

    it('revokes privileges from all tables in schema', () => {
      const args: RevokeOnTablesParameters = [
        {
          privileges: ['DELETE', 'INSERT'],
          tables: 'ALL',
          schema: 'schema1',
          roles: ['role1', 'role2'],
        },
      ]
      const sql = Grants.revokeOnTables(options1)(...args)
      expect(sql).to.equal(`REVOKE DELETE,INSERT ON ALL TABLES IN SCHEMA "schema1" FROM "role1","role2";`)
    })
  })

  describe('.grantOnSchemas', () => {
    it('grants schemas', () => {
      const args: GrantOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'role1',
        },
      ]
      const sql = Grants.grantOnSchemas(options1)(...args)
      expect(sql).to.equal(`GRANT USAGE ON SCHEMA "schema1" TO "role1";`)
    })
  })

  describe('.revokeOnSchemas', () => {
    it('revokes schemas privileges', () => {
      const args: RevokeOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'role1',
        },
      ]
      const sql = Grants.revokeOnSchemas(options1)(...args)
      expect(sql).to.equal(`REVOKE USAGE ON SCHEMA "schema1" FROM "role1";`)
    })
  })
})
