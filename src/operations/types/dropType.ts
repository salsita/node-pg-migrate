import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropTypeOptions = DropOptions;

export type DropType = (
  typeName: Name,
  dropOptions?: DropTypeOptions
) => string;

export function dropType(mOptions: MigrationOptions): DropType {
  const _drop: DropType = (typeName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const typeNameStr = mOptions.literal(typeName);

    return `DROP TYPE${ifExistsStr} ${typeNameStr}${cascadeStr};`;
  };

  return _drop;
}
