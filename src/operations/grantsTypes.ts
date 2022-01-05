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
export type GrantRoles = GrantRolesFn & { reverse: GrantRoles }

type TablePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER'
type SchemaPrivilege = 'CREATE' | 'USAGE'

interface GrantOnSomeTablesProps {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  tables: Name | Name[]
  roles: Name | Name[]
}

interface GrantOnAllTablesProps {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL'
  tables: 'ALL'
  schema: string
  roles: Name | Name[]
}

type GrantOnTablesProps = (GrantOnSomeTablesProps | GrantOnAllTablesProps) & WithGrantOption

type GrantOnTablesFn = (props: GrantOnTablesProps) => string | string[]

export type GrantOnTables = GrantOnTablesFn & { reverse: GrantOnTables }

interface GrantOnSchemasProps {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL'
  schemas: string[] | string
  roles: Name | Name[]
}

type GrantOnSchemasFn = (props: GrantOnSchemasProps & WithGrantOption) => string | string[]
export type GrantOnSchemas = GrantOnSchemasFn & { reverse: GrantOnSchemasFn }
