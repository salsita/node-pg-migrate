import type { MigrationOptions } from '../../types';
import type { IfExistsOption, Name } from '../generalTypes';
import { dropRole } from './dropRole';
import type { RoleOptions } from './shared';
import { formatRoleOptions } from './shared';

export type CreateRoleFn = (
  roleName: Name,
  roleOptions?: RoleOptions & IfExistsOption
) => string | string[];

export type CreateRole = CreateRoleFn & { reverse: CreateRoleFn };

export function createRole(mOptions: MigrationOptions): CreateRole {
  const _create: CreateRole = (roleName, roleOptions = {}) => {
    const options = formatRoleOptions({
      ...roleOptions,
      superuser: roleOptions.superuser || false,
      createdb: roleOptions.createdb || false,
      createrole: roleOptions.createrole || false,
      inherit: roleOptions.inherit !== false,
      login: roleOptions.login || false,
      replication: roleOptions.replication || false,
    });
    const optionsStr = options ? ` WITH ${options}` : '';

    return `CREATE ROLE ${mOptions.literal(roleName)}${optionsStr};`;
  };

  _create.reverse = dropRole(mOptions);

  return _create;
}
