import type { MigrationOptions } from '../../types';
import type { DropOptions } from '../generalTypes';

export type DropCast = (
  fromType: string,
  toType: string,
  dropOptions: DropOptions
) => string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dropCast(mOptions: MigrationOptions): DropCast {
  const _drop: DropCast = (fromType, toType, options = {}) => {
    const { ifExists } = options;
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';

    return `DROP CAST${ifExistsStr} (${fromType} AS ${toType});`;
  };

  return _drop;
}
