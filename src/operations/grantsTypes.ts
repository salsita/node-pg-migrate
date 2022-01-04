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
  readonly withGrantOption?: true
}

type Privilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'

type GrantAllTablesProps = {
  privileges: Privilege | Privilege[] | 'ALL'
  tables: 'ALL'
  schema: string
  roles: Name | Name[]
} & GrantTablesOptions

type GrantSomeTablesProps = {
  privileges: Privilege | Privilege[] | 'ALL'
  tables: Name | Name[]
  roles: Name | Name[]
} & GrantTablesOptions

type GrantTablesProps = GrantAllTablesProps | GrantSomeTablesProps
type GrantTablesFn = (props: GrantTablesProps) => string | string[]
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

interface ColumnPrivilege {
  privileges: 'ALL' | 'SELECT' | 'INSERT'
  name: string
}

interface GrantOnColumnsProps extends GrantTablesOptions {
  columns: ColumnPrivilege[]
  tableNames: Name | Name[]
  roles: Name | Name[]
}

interface GrantOnSomeTablesProps extends GrantTablesOptions {
  privileges: Privilege | Privilege[] | 'ALL'
  tableNames: Name | Name[]
  roles: Name | Name[]
}

interface GrantOnAllTablesProps extends GrantTablesOptions {
  privileges: Privilege | Privilege[] | 'ALL'
  tableNames: 'ALL'
  schema: string
  roles: Name | Name[]
}

interface GrantOnSchemasProps extends GrantTablesOptions {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL'
  schemas: string[] | string
  roles: Name | Name[]
}

type GrantOnTablesProps = GrantOnSomeTablesProps | GrantOnAllTablesProps
type GrantOnTablesFn = (dbObjectType: 'TABLES', props: GrantOnTablesProps) => string | string[]
type GrantOnColumnsFn = (dbObjectType: 'COLUMNS', props: GrantOnColumnsProps) => string | string[]
type GrantOnSchemasFn = (dbObjectType: 'SCHEMAS', props: GrantOnSchemasProps) => string | string[]

type GrantOnFn = GrantOnTablesFn | GrantOnColumnsFn | GrantOnSchemasFn
export type GrantOn = GrantOnFn & { reverse: GrantOnFn }
