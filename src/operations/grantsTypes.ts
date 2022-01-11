import { CascadeOption, Name } from '..'

interface WithAdminOption {
  readonly withAdminOption?: boolean
}

interface OnlyAdminOption {
  readonly onlyAdminOption?: boolean
}

interface OnlyGrantOption {
  readonly onlyGrantOption?: boolean
}

interface WithGrantOption {
  readonly withGrantOption?: boolean
}

export type RevokeRolesOptions = OnlyAdminOption & CascadeOption
export type GrantRolesOptions = WithAdminOption & RevokeRolesOptions
type GrantRolesFn = (
  rolesFrom: Name | Name[],
  rolesTo: Name | Name[],
  grantRolesOptions?: GrantRolesOptions,
) => string | string[]
export type GrantRoles = GrantRolesFn & { reverse: GrantRolesFn }
export type RevokeRoles = (
  roles: Name | Name[],
  rolesFrom: Name | Name[],
  revokeRolesOptions?: RevokeRolesOptions,
) => string | string[]

export type TablePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'
export type SchemaPrivilege = 'CREATE' | 'USAGE'

interface CommonOnTablesOptions {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  roles: Name | Name[]
}

type CommonGrantOnTablesOptions = CommonOnTablesOptions & WithGrantOption

export interface SomeTablesOptions {
  tables: Name | Name[]
}

export interface AllTablesOptions {
  tables: 'ALL'
  schema: string
}

type RevokeOnObjectsOptions = OnlyGrantOption & CascadeOption

export type GrantOnSomeTablesOptions = CommonGrantOnTablesOptions & SomeTablesOptions
export type GrantOnAllTablesOptions = CommonGrantOnTablesOptions & AllTablesOptions

export type GrantOnTablesOptions = GrantOnSomeTablesOptions | GrantOnAllTablesOptions
export type RevokeOnTablesOptions = CommonOnTablesOptions &
  (AllTablesOptions | SomeTablesOptions) &
  RevokeOnObjectsOptions

type GrantOnTablesFn = (options: GrantOnTablesOptions & RevokeOnObjectsOptions) => string | string[]

export type GrantOnTables = GrantOnTablesFn & { reverse: GrantOnTablesFn }
export type RevokeOnTables = (options: RevokeOnTablesOptions) => string | string[]

export interface OnlyGrantOnSchemasOptions {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL'
  schemas: string[] | string
  roles: Name | Name[]
}
export type GrantOnSchemasOptions = OnlyGrantOnSchemasOptions & WithGrantOption & RevokeOnObjectsOptions
export type RevokeOnSchemasOptions = OnlyGrantOnSchemasOptions & RevokeOnObjectsOptions
type GrantOnSchemasFn = (options: GrantOnSchemasOptions) => string | string[]
export type GrantOnSchemas = GrantOnSchemasFn & { reverse: GrantOnSchemasFn }
export type RevokeOnSchemas = (options: RevokeOnSchemasOptions) => string | string[]
