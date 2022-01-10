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

interface RestrictOption {
  readonly restrict?: boolean
}

interface WithGrantOption {
  readonly withGrantOption?: boolean
}

export type RevokeRolesOptions = OnlyAdminOption & RestrictOption
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
  RevokeRolesOptions?: RevokeRolesOptions,
) => string | string[]

export type TablePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'
export type SchemaPrivilege = 'CREATE' | 'USAGE'

interface CommonOnTablesProps {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  roles: Name | Name[]
}

type CommonGrantOnTablesProps = CommonOnTablesProps & WithGrantOption

interface OnlyGrantOnSomeTablesProps {
  tables: Name | Name[]
}

interface OnlyGrantOnAllTablesProps {
  tables: 'ALL'
  schema: string
}

type RevokeOnObjectsProps = OnlyGrantOption & RestrictOption & CascadeOption

export type GrantOnSomeTablesProps = CommonGrantOnTablesProps & OnlyGrantOnSomeTablesProps
export type GrantOnAllTablesProps = CommonGrantOnTablesProps & OnlyGrantOnAllTablesProps

export type GrantOnTablesProps = GrantOnSomeTablesProps | GrantOnAllTablesProps
export type RevokeOnTablesProps = CommonOnTablesProps &
  (OnlyGrantOnAllTablesProps | OnlyGrantOnSomeTablesProps) &
  RevokeOnObjectsProps

type GrantOnTablesFn = (props: GrantOnTablesProps & RevokeOnObjectsProps) => string | string[]

export type GrantOnTables = GrantOnTablesFn & { reverse: GrantOnTablesFn }
export type RevokeOnTables = (props: RevokeOnTablesProps) => string | string[]

export interface OnlyGrantOnSchemasProps {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL'
  schemas: string[] | string
  roles: Name | Name[]
}
export type GrantOnSchemasProps = OnlyGrantOnSchemasProps & WithGrantOption & RevokeOnObjectsProps
export type RevokeOnSchemasProps = OnlyGrantOnSchemasProps & RevokeOnObjectsProps
type GrantOnSchemasFn = (props: GrantOnSchemasProps) => string | string[]
export type GrantOnSchemas = GrantOnSchemasFn & { reverse: GrantOnSchemasFn }
export type RevokeOnSchemas = (props: RevokeOnSchemasProps) => string | string[]
