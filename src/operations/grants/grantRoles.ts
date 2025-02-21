import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { RevokeRolesOptions } from './revokeRoles';
import { revokeRoles } from './revokeRoles';
import type { WithAdminOption } from './shared';

export type GrantRolesOptions = WithAdminOption;

export type GrantRolesFn = (
  rolesFrom: Name | Name[],
  rolesTo: Name | Name[],
  grantOptions?: GrantRolesOptions & RevokeRolesOptions
) => string;

export type GrantRoles = Reversible<GrantRolesFn>;

export function grantRoles(mOptions: MigrationOptions): GrantRoles {
  const _grantRoles: GrantRoles = (rolesFrom, rolesTo, options = {}) => {
    const { withAdminOption = false } = options;

    const rolesFromStr = toArray(rolesFrom).map(mOptions.literal).join(', ');
    const rolesToStr = toArray(rolesTo).map(mOptions.literal).join(', ');
    const withAdminOptionStr = withAdminOption ? ' WITH ADMIN OPTION' : '';

    return `GRANT ${rolesFromStr} TO ${rolesToStr}${withAdminOptionStr};`;
  };

  _grantRoles.reverse = revokeRoles(mOptions);

  return _grantRoles;
}
