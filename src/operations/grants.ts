import { MigrationOptions } from '../types'
import { GrantRoles, GrantOnTables, GrantOnSchemas } from './grantsTypes'

export { GrantRoles, GrantOnTables, GrantOnSchemas }

const isArray = <T>(item: T | T[]): item is T[] => {
  return typeof item !== 'string' && Boolean((item as Array<T>).length !== undefined)
}

export function grantRoles(mOptions: MigrationOptions) {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo) => {
    const _rolesFrom = isArray(rolesFrom) ? rolesFrom : [rolesFrom]
    const _rolesTo = isArray(rolesTo) ? rolesTo : [rolesTo]
    console.log(_rolesFrom, isArray(_rolesFrom), isArray(rolesFrom))
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
