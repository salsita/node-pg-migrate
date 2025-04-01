import type { MigrationOptions } from '../../migrationOptions';
import type { IfExistsOption } from '../generalTypes';

export type DropCastOptions = IfExistsOption;

export type DropCast = (
  fromType: string,
  toType: string,
  dropOptions?: DropCastOptions
) => string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dropCast(mOptions: MigrationOptions): DropCast {
  const _drop: DropCast = (sourceType, targetType, options = {}) => {
    const { ifExists = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';

    return `DROP CAST${ifExistsStr} (${sourceType} AS ${targetType});`;
  };

  return _drop;
}
