import type { MigrationOptions } from '../../migrationOptions';
import type { Name } from '../generalTypes';
import type { RoleOptions } from './shared';
import { formatRoleOptions } from './shared';

export type AlterRole = (roleName: Name, roleOptions: RoleOptions) => string;

export function alterRole(mOptions: MigrationOptions): AlterRole {
  const _alter: AlterRole = (roleName, roleOptions = {}) => {
    const options = formatRoleOptions(roleOptions);

    return options
      ? `ALTER ROLE ${mOptions.literal(roleName)} WITH ${options};`
      : '';
  };

  return _alter;
}
