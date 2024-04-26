import type { MigrationOptions } from '../../types';
import { toArray } from '../../utils';
import type { CascadeOption, Name } from '../generalTypes';
import type { OnlyAdminOption } from './shared';

export type RevokeRolesOptions = OnlyAdminOption & CascadeOption;

export type RevokeRoles = (
  roles: Name | Name[],
  rolesFrom: Name | Name[],
  revokeRolesOptions?: RevokeRolesOptions
) => string | string[];

export function revokeRoles(mOptions: MigrationOptions): RevokeRoles {
  const _revokeRoles: RevokeRoles = (roles, rolesFrom, options) => {
    const rolesStr = toArray(roles).map(mOptions.literal).join(', ');
    const rolesToStr = toArray(rolesFrom).map(mOptions.literal).join(', ');
    const onlyAdminOptionStr =
      options && options.onlyAdminOption ? ' ADMIN OPTION FOR' : '';
    const cascadeStr = options && options.cascade ? ' CASCADE' : '';

    return `REVOKE${onlyAdminOptionStr} ${rolesStr} FROM ${rolesToStr}${cascadeStr};`;
  };

  return _revokeRoles;
}
