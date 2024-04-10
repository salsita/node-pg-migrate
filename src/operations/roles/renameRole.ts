import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameRoleFn = (
  oldRoleName: Name,
  newRoleName: Name
) => string | string[];

export type RenameRole = RenameRoleFn & { reverse: RenameRoleFn };

export function renameRole(mOptions: MigrationOptions): RenameRole {
  const _rename: RenameRole = (oldRoleName, newRoleName) => {
    const oldRoleNameStr = mOptions.literal(oldRoleName);
    const newRoleNameStr = mOptions.literal(newRoleName);

    return `ALTER ROLE ${oldRoleNameStr} RENAME TO ${newRoleNameStr};`;
  };

  _rename.reverse = (oldRoleName, newRoleName) =>
    _rename(newRoleName, oldRoleName);

  return _rename;
}
