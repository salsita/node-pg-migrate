import { MigrationOptions } from '../types'
import { Grant, Revoke } from './grantTypes'

export function revoke(mOptions: MigrationOptions) {
  const _revoke: Revoke = (privilege, table, roleSpecification) => {
    return `REVOKE ${privilege} ON ${table} TO ${roleSpecification}`
  }
  return _revoke
}

export function grant(mOptions: MigrationOptions) {
  const _grant: Grant = (privilege, table, roleSpecification) => {
    return `GRANT ${privilege} ON ${table} TO ${roleSpecification}`
  }
  _grant.reverse = revoke(mOptions)
  return _grant
}
