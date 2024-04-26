import type { MigrationOptions } from '../../types';
import { toArray } from '../../utils';
import type { Name } from '../generalTypes';
import type { RevokeRolesOptions } from './revokeRoles';
import { revokeRoles } from './revokeRoles';
import type { WithAdminOption } from './shared';

export type GrantRolesOptions = WithAdminOption & RevokeRolesOptions;

export type GrantRolesFn = (
  rolesFrom: Name | Name[],
  rolesTo: Name | Name[],
  grantRolesOptions?: GrantRolesOptions
) => string | string[];

export type GrantRoles = GrantRolesFn & { reverse: GrantRolesFn };

export function grantRoles(mOptions: MigrationOptions): GrantRoles {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo, options) => {
    const rolesFromStr = toArray(rolesFrom).map(mOptions.literal).join(', ');
    const rolesToStr = toArray(rolesTo).map(mOptions.literal).join(', ');
    const withAdminOptionStr =
      options && options.withAdminOption ? ' WITH ADMIN OPTION' : '';

    return `GRANT ${rolesFromStr} TO ${rolesToStr}${withAdminOptionStr};`;
  };

  _grantRoles.reverse = revokeRoles(mOptions);

  return _grantRoles;
}
