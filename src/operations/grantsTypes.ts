import { Name } from '..'

interface WithAdminOption {
  readonly withAdminOption?: boolean
}

interface WithGrantOption {
  readonly withGrantOption?: boolean
}

type GrantRolesFn = (
  rolesFrom: Name | Name[],
  rolesTo: Name | Name[],
  roleOptions?: WithAdminOption,
) => string | string[]
export type GrantRoles = GrantRolesFn & { reverse: GrantRolesFn }

type TablePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'
type SchemaPrivilege = 'CREATE' | 'USAGE'

export interface GrantOnSomeTablesProps extends WithGrantOption {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  tables: Name | Name[]
  roles: Name | Name[]
}

export interface GrantOnAllTablesProps extends WithGrantOption {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  tables: 'ALL'
  schema: string
  roles: Name | Name[]
}

export type GrantOnTablesProps = GrantOnSomeTablesProps | GrantOnAllTablesProps

type GrantOnTablesFn = (props: GrantOnTablesProps) => string | string[]

export type GrantOnTables = GrantOnTablesFn & { reverse: GrantOnTablesFn }

interface GrantOnSchemasProps {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL'
  schemas: string[] | string
  roles: Name | Name[]
}

type GrantOnSchemasFn = (props: GrantOnSchemasProps & WithGrantOption) => string | string[]
export type GrantOnSchemas = GrantOnSchemasFn & { reverse: GrantOnSchemasFn }
