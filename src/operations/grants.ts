import { MigrationOptions } from '../types'
import {
  TablePrivilege,
  SchemaPrivilege,
  GrantRoles,
  GrantRolesOptions,
  GrantOnTables,
  GrantOnTablesProps,
  GrantOnAllTablesProps,
  GrantOnSchemas,
  GrantOnSchemasProps,
  RevokeRoles,
  RevokeRolesOptions,
  RevokeOnTables,
  RevokeOnTablesProps,
  RevokeOnSchemas,
  RevokeOnSchemasProps,
} from './grantsTypes'

export {
  TablePrivilege,
  SchemaPrivilege,
  GrantRoles,
  GrantRolesOptions,
  GrantOnTables,
  GrantOnTablesProps,
  GrantOnSchemas,
  GrantOnSchemasProps,
  RevokeRoles,
  RevokeRolesOptions,
  RevokeOnTables,
  RevokeOnTablesProps,
  RevokeOnSchemas,
  RevokeOnSchemasProps,
}

const isArray = <T>(item: T | T[]): item is T[] => {
  return typeof item !== 'string' && Boolean((item as Array<T>).length !== undefined)
}

const asArray = <T>(item: T | T[]) => (isArray(item) ? item : [item])

const isGrantOnAllTablesProps = (props: GrantOnTablesProps): props is GrantOnAllTablesProps => {
  return 'schema' in props
}

export function revokeRoles(mOptions: MigrationOptions) {
  const _revokeRoles: RevokeRoles = () => ''
  return _revokeRoles
}

export function grantRoles(mOptions: MigrationOptions) {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo, options) => {
    const rolesFromStr = asArray(rolesFrom).map(mOptions.literal).join(',')
    const rolesToStr = asArray(rolesTo).map(mOptions.literal).join(',')
    return `GRANT ${rolesFromStr} TO ${rolesToStr};`
  }
  _grantRoles.reverse = revokeRoles(mOptions)
  return _grantRoles
}

export function revokeOnTables(mOptions: MigrationOptions) {
  const _revokeOnTables: RevokeOnTables = () => ''
  return _revokeOnTables
}

export function grantOnTables(mOptions: MigrationOptions) {
  const _grantOnTables: GrantOnTables = (props) => {
    const { privileges, roles, withGrantOption } = props
    const rolesStr = asArray(roles).map(mOptions.literal).join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    let tablesStr
    if (isGrantOnAllTablesProps(props)) {
      const { schema } = props
      tablesStr = `ALL TABLES IN SCHEMA ${mOptions.literal(schema)}`
    } else {
      const { tables } = props
      tablesStr = asArray(tables).map(mOptions.literal).join(',')
    }
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : ''
    return `GRANT ${privilegesStr} ON ${tablesStr} TO ${rolesStr}${withGrantOptionStr};`
  }
  _grantOnTables.reverse = revokeOnTables(mOptions)
  return _grantOnTables
}

export function revokeOnSchemas(mOptions: MigrationOptions) {
  const _revokeOnSchemas: RevokeOnSchemas = () => ''
  return _revokeOnSchemas
}

export function grantOnSchemas(mOptions: MigrationOptions) {
  const _grantOnSchemas: GrantOnSchemas = ({ privileges, schemas, roles, withGrantOption }) => {
    const rolesStr = asArray(roles).map(mOptions.literal).join(',')
    const schemasStr = asArray(schemas).map(mOptions.literal).join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : ''
    return `GRANT ${privilegesStr} ON SCHEMA ${schemasStr} TO ${rolesStr}${withGrantOptionStr};`
  }
  _grantOnSchemas.reverse = revokeOnSchemas(mOptions)
  return _grantOnSchemas
}
