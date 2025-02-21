import type { MigrationOptions } from '../../migrationOptions';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropRoleOptions = IfExistsOption;

export type DropRole = (
  roleName: Name,
  dropOptions?: DropRoleOptions
) => string;

export function dropRole(mOptions: MigrationOptions): DropRole {
  const _drop: DropRole = (roleName, options = {}) => {
    const { ifExists = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const roleNameStr = mOptions.literal(roleName);

    return `DROP ROLE${ifExistsStr} ${roleNameStr};`;
  };

  return _drop;
}
