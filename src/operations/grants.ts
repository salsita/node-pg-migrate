import { MigrationOptions } from '../types'
import { GrantRoles, GrantOnTables, GrantOnSchemas } from './grantsTypes'

export { GrantRoles, GrantOnTables, GrantOnSchemas }

const isArray = <T>(item: T | T[]): item is T[] => {
  return Boolean((item as Array<T>).length)
}

export function grantRoles(mOptions: MigrationOptions) {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo) => {
    const _rolesFrom = isArray(rolesFrom) ? rolesFrom : [rolesFrom]
    const _rolesTo = isArray(rolesTo) ? rolesTo : [rolesTo]
    const rolesFromStr = _rolesFrom.map(mOptions.literal).join(',')
    const rolesToStr = _rolesTo.map(mOptions.literal).join(',')
    return `GRANT ${rolesFromStr} TO ${rolesToStr};`
  }
  _grantRoles.reverse = () => {
    console.log('reverse')
    return ''
  }
  return _grantRoles
}
