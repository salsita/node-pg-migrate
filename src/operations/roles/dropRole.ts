import type { MigrationOptions } from '../../types';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropRole = (roleName: Name, options?: IfExistsOption) => string;

export function dropRole(mOptions: MigrationOptions): DropRole {
  const _drop: DropRole = (roleName, options = {}) => {
    const { ifExists } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const roleNameStr = mOptions.literal(roleName);

    return `DROP ROLE${ifExistsStr} ${roleNameStr};`;
  };

  return _drop;
}
