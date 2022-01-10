import { MigrationOptions } from '../types'
import {
  TablePrivilege,
  SchemaPrivilege,
  GrantRoles,
  GrantRolesOptions,
  GrantOnTables,
  GrantOnTablesOptions,
  GrantOnAllTablesOptions,
  GrantOnSchemas,
  GrantOnSchemasOptions,
  RevokeRoles,
  RevokeRolesOptions,
  RevokeOnTables,
  RevokeOnTablesOptions,
  RevokeOnSchemas,
  RevokeOnSchemasOptions,
} from './grantsTypes'

export {
  TablePrivilege,
  SchemaPrivilege,
  GrantRoles,
  GrantRolesOptions,
  GrantOnTables,
  GrantOnTablesOptions,
  GrantOnSchemas,
  GrantOnSchemasOptions,
  RevokeRoles,
  RevokeRolesOptions,
  RevokeOnTables,
  RevokeOnTablesOptions,
  RevokeOnSchemas,
  RevokeOnSchemasOptions,
}

const isArray = <T>(item: T | T[]): item is T[] => {
  return typeof item !== 'string' && Boolean((item as Array<T>).length !== undefined)
}

const asArray = <T>(item: T | T[]) => (isArray(item) ? item : [item])

const isGrantOnAllTablesOptions = (options: GrantOnTablesOptions): options is GrantOnAllTablesOptions => {
  return 'schema' in options
}

export function revokeRoles(mOptions: MigrationOptions) {
  const _revokeRoles: RevokeRoles = (roles, rolesFrom, options) => {
    const rolesStr = asArray(roles).map(mOptions.literal).join(',')
    const rolesToStr = asArray(rolesFrom).map(mOptions.literal).join(',')
    const onlyAdminOptionStr = options && options.onlyAdminOption ? ' ADMIN OPTION FOR' : ''
    const cascadeStr = options && options.cascade ? ' CASCADE' : ''
    return `REVOKE${onlyAdminOptionStr} ${rolesStr} FROM ${rolesToStr}${cascadeStr};`
  }
  return _revokeRoles
}

export function grantRoles(mOptions: MigrationOptions) {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo, options) => {
    const rolesFromStr = asArray(rolesFrom).map(mOptions.literal).join(',')
    const rolesToStr = asArray(rolesTo).map(mOptions.literal).join(',')
    const withAdminOptionStr = options && options.withAdminOption ? ' WITH ADMIN OPTION' : ''
    return `GRANT ${rolesFromStr} TO ${rolesToStr}${withAdminOptionStr};`
  }
  _grantRoles.reverse = revokeRoles(mOptions)
  return _grantRoles
}

export function revokeOnTables(mOptions: MigrationOptions) {
  const _revokeOnTables: RevokeOnTables = (options) => {
    const { privileges, roles, onlyGrantOption, cascade } = options
    const rolesStr = asArray(roles)
      .map((role) => (role === 'PUBLIC' ? role : mOptions.literal(role)))
      .join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    let tablesStr
    if (isGrantOnAllTablesOptions(options)) {
      const { schema } = options
      tablesStr = `ALL TABLES IN SCHEMA ${mOptions.literal(schema)}`
    } else {
      const { tables } = options
      tablesStr = asArray(tables).map(mOptions.literal).join(',')
    }
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON ${tablesStr} FROM ${rolesStr}${cascadeStr};`
  }
  return _revokeOnTables
}

export function grantOnTables(mOptions: MigrationOptions) {
  const _grantOnTables: GrantOnTables = (options) => {
    const { privileges, roles, withGrantOption } = options
    const rolesStr = asArray(roles)
      .map((role) => (role === 'PUBLIC' ? role : mOptions.literal(role)))
      .join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    let tablesStr
    if (isGrantOnAllTablesOptions(options)) {
      const { schema } = options
      tablesStr = `ALL TABLES IN SCHEMA ${mOptions.literal(schema)}`
    } else {
      const { tables } = options
      tablesStr = asArray(tables).map(mOptions.literal).join(',')
    }
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : ''
    return `GRANT ${privilegesStr} ON ${tablesStr} TO ${rolesStr}${withGrantOptionStr};`
  }
  _grantOnTables.reverse = revokeOnTables(mOptions)
  return _grantOnTables
}

export function revokeOnSchemas(mOptions: MigrationOptions) {
  const _revokeOnSchemas: RevokeOnSchemas = ({ privileges, schemas, roles, onlyGrantOption, cascade }) => {
    const rolesStr = asArray(roles)
      .map((role) => (role === 'PUBLIC' ? role : mOptions.literal(role)))
      .join(',')
    const schemasStr = asArray(schemas).map(mOptions.literal).join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : ''
    const cascadeStr = cascade ? ' CASCADE' : ''
    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON SCHEMA ${schemasStr} FROM ${rolesStr}${cascadeStr};`
  }
  return _revokeOnSchemas
}

export function grantOnSchemas(mOptions: MigrationOptions) {
  const _grantOnSchemas: GrantOnSchemas = ({ privileges, schemas, roles, withGrantOption }) => {
    const rolesStr = asArray(roles)
      .map((role) => (role === 'PUBLIC' ? role : mOptions.literal(role)))
      .join(',')
    const schemasStr = asArray(schemas).map(mOptions.literal).join(',')
    const privilegesStr = asArray(privileges).map(String).join(',')
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : ''
    return `GRANT ${privilegesStr} ON SCHEMA ${schemasStr} TO ${rolesStr}${withGrantOptionStr};`
  }
  _grantOnSchemas.reverse = revokeOnSchemas(mOptions)
  return _grantOnSchemas
}
