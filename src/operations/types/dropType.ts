import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropType = (typeName: Name, dropOptions?: DropOptions) => string;

export function dropType(mOptions: MigrationOptions): DropType {
  const _drop: DropType = (typeName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const typeNameStr = mOptions.literal(typeName);

    return `DROP TYPE${ifExistsStr} ${typeNameStr}${cascadeStr};`;
  };

  return _drop;
}
