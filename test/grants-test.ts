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
    it('grants one role to another with admin option', () => {
      const args: GrantRolesParameters = ['role1', 'role2', { withAdminOption: true }]
      const sql = Grants.grantRoles(options1)(...args)
      expect(sql).to.equal(`GRANT "role1" TO "role2" WITH ADMIN OPTION;`)
    })

    it('grants two roles to other two', () => {
      const args: GrantRolesParameters = [
        ['role1', 'role2'],
        ['role3', 'role4'],
      ]
      const sql = Grants.grantRoles(options1)(...args)
      expect(sql).to.equal(`GRANT "role1","role2" TO "role3","role4";`)
    })
  })

  describe('.revokeRoles', () => {
    it('revokes one role from another with CASCADE and ADMIN OPTION', () => {
      const args: RevokeRolesParameters = [
        'role1',
        'role2',
        {
          onlyAdminOption: true,
          cascade: true,
        },
      ]
      const sql = Grants.revokeRoles(options1)(...args)
      expect(sql).to.equal(`REVOKE ADMIN OPTION FOR "role1" FROM "role2" CASCADE;`)
    })

    it('revokes two roles from other two', () => {
      const args: RevokeRolesParameters = [
        ['role1', 'role2'],
        ['role3', 'role4'],
      ]
      const sql = Grants.revokeRoles(options1)(...args)
      expect(sql).to.equal(`REVOKE "role1","role2" FROM "role3","role4";`)
    })
  })

  describe('.grantOnTables', () => {
    it('grants one privilege with grant privilege', () => {
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

    it('grants two privileges', () => {
      const args: GrantOnTablesParameters = [
        {
          privileges: ['INSERT', 'DELETE'],
          tables: ['table1', 'table2'],
          roles: ['role1', 'PUBLIC'],
        },
      ]

      const sql = Grants.grantOnTables(options1)(...args)
      expect(sql).to.equal(`GRANT INSERT,DELETE ON "table1","table2" TO "role1",PUBLIC;`)
    })

    it('grants all privileges for all tables in schema', () => {
      const args: GrantOnTablesParameters = [
        {
          privileges: 'ALL',
          tables: 'ALL',
          schema: 'schema1',
          roles: 'PUBLIC',
        },
      ]

      const sql = Grants.grantOnTables(options1)(...args)
      expect(sql).to.equal(`GRANT ALL ON ALL TABLES IN SCHEMA "schema1" TO PUBLIC;`)
    })
  })

  describe('.revokeOnTables', () => {
    it('revokes only grant privilege for one table privilege with cascade', () => {
      const args: RevokeOnTablesParameters = [
        {
          privileges: 'DELETE',
          tables: 'table1',
          roles: 'role1',
          onlyGrantOption: true,
          cascade: true,
        },
      ]
      const sql = Grants.revokeOnTables(options1)(...args)
      expect(sql).to.equal(`REVOKE GRANT OPTION FOR DELETE ON "table1" FROM "role1" CASCADE;`)
    })

    it('revokes two privileges', () => {
      const args: RevokeOnTablesParameters = [
        {
          privileges: ['DELETE', 'INSERT'],
          tables: ['table1', 'table2'],
          roles: ['role1', 'PUBLIC'],
        },
      ]
      const sql = Grants.revokeOnTables(options1)(...args)
      expect(sql).to.equal(`REVOKE DELETE,INSERT ON "table1","table2" FROM "role1",PUBLIC;`)
    })

    it('revokes privileges from all tables in schema', () => {
      const args: RevokeOnTablesParameters = [
        {
          privileges: 'ALL',
          tables: 'ALL',
          schema: 'schema1',
          roles: 'PUBLIC',
        },
      ]
      const sql = Grants.revokeOnTables(options1)(...args)
      expect(sql).to.equal(`REVOKE ALL ON ALL TABLES IN SCHEMA "schema1" FROM PUBLIC;`)
    })
  })

  describe('.grantOnSchemas', () => {
    it('grants schema privilege with grant option', () => {
      const args: GrantOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'role1',
          withGrantOption: true,
        },
      ]
      const sql = Grants.grantOnSchemas(options1)(...args)
      expect(sql).to.equal(`GRANT USAGE ON SCHEMA "schema1" TO "role1" WITH GRANT OPTION;`)
    })

    it('grants schema privileges', () => {
      const args: GrantOnSchemasParameters = [
        {
          privileges: ['USAGE', 'CREATE'],
          schemas: ['schema1', 'schema2'],
          roles: ['role1', 'PUBLIC'],
        },
      ]
      const sql = Grants.grantOnSchemas(options1)(...args)
      expect(sql).to.equal(`GRANT USAGE,CREATE ON SCHEMA "schema1","schema2" TO "role1",PUBLIC;`)
    })

    it('grants to PUBLIC', () => {
      const args: GrantOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'PUBLIC',
        },
      ]
      const sql = Grants.grantOnSchemas(options1)(...args)
      expect(sql).to.equal(`GRANT USAGE ON SCHEMA "schema1" TO PUBLIC;`)
    })
  })

  describe('.revokeOnSchemas', () => {
    it('revokes only grant option of schema privilege with cascade', () => {
      const args: RevokeOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'role1',
          onlyGrantOption: true,
          cascade: true,
        },
      ]
      const sql = Grants.revokeOnSchemas(options1)(...args)
      expect(sql).to.equal(`REVOKE GRANT OPTION FOR USAGE ON SCHEMA "schema1" FROM "role1" CASCADE;`)
    })

    it('revokes schema privileges', () => {
      const args: RevokeOnSchemasParameters = [
        {
          privileges: ['USAGE', 'CREATE'],
          schemas: ['schema1', 'schema2'],
          roles: ['role1', 'PUBLIC'],
        },
      ]
      const sql = Grants.revokeOnSchemas(options1)(...args)
      expect(sql).to.equal(`REVOKE USAGE,CREATE ON SCHEMA "schema1","schema2" FROM "role1",PUBLIC;`)
    })

    it('revokes from PUBLIC', () => {
      const args: RevokeOnSchemasParameters = [
        {
          privileges: 'USAGE',
          schemas: 'schema1',
          roles: 'PUBLIC',
        },
      ]
      const sql = Grants.revokeOnSchemas(options1)(...args)
      expect(sql).to.equal(`REVOKE USAGE ON SCHEMA "schema1" FROM PUBLIC;`)
    })
  })
})
