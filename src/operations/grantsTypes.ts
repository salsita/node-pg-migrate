import { Name } from '..'

interface GrantRolesOptions {
  readonly withAdminOption: true
}

type GrantRolesFn = (
  rolesFrom: Name | Name[],
  rolesTo: Name | Name[],
  roleOptions?: GrantRolesOptions,
) => string | string[]
export type GrantRoles = GrantRolesFn & { reverse: GrantRoles }

interface GrantTablesOptions {
  readonly withGrantOption: true
}

type Privilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'

type GrantTablesFn = (
  privileges: Privilege | Privilege[],
  tables: Name | Name[],
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantTables = GrantTablesFn & { reverse: GrantTables }

type GrantTablesAllFn = (
  tables: Name | Name[],
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantTablesAll = GrantTablesAllFn & { reverse: GrantTablesAll }

type GrantAllTablesAllFn = (
  schemeName: string,
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantAllTablesAll = GrantAllTablesAllFn & { reverse: GrantAllTablesAll }

type GrantAllTablesFn = (
  privileges: Privilege | Privilege[],
  schemeName: string,
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantAllTables = GrantAllTablesFn & { reverse: GrantAllTables }

type SchemaPrivilege = 'CREATE' | 'USAGE'

type GrantSchemaFn = (
  privileges: SchemaPrivilege | SchemaPrivilege[],
  schemas: Name | Name[],
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantSchema = GrantSchemaFn & { reverse: GrantSchemaFn }

type GrantSchemaAllFn = (
  schemas: Name | Name[],
  roles: Name | Name[],
  roleOptions?: GrantTablesOptions,
) => string | string[]
export type GrantSchemaAll = GrantSchemaAllFn & { reverse: GrantSchemaAllFn }
