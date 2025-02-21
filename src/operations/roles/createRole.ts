import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import type { DropRoleOptions } from './dropRole';
import { dropRole } from './dropRole';
import type { RoleOptions } from './shared';
import { formatRoleOptions } from './shared';

export type CreateRoleOptions = RoleOptions;

export type CreateRoleFn = (
  roleName: Name,
  roleOptions?: CreateRoleOptions & DropRoleOptions
) => string;

export type CreateRole = Reversible<CreateRoleFn>;

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
