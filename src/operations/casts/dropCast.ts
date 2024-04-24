import type { MigrationOptions } from '../../types';
import type { DropOptions } from '../generalTypes';

export type DropCast = (
  fromType: string,
  toType: string,
  dropOptions: DropOptions
) => string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dropCast(_mOptions: MigrationOptions): DropCast {
  const _drop: DropCast = (_fromType, _toType, options = {}) => {
    const ifExists = options.ifExists ? ' IF EXISTS' : '';

    return `DROP CAST${ifExists} (${_fromType} AS ${_toType});`;
  };

  return _drop;
}
