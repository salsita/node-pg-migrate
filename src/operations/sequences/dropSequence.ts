import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropSequence = (
  sequenceName: Name,
  dropOptions?: DropOptions
) => string | string[];

export function dropSequence(mOptions: MigrationOptions): DropSequence {
  const _drop: DropSequence = (sequenceName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const sequenceNameStr = mOptions.literal(sequenceName);

    return `DROP SEQUENCE${ifExistsStr} ${sequenceNameStr}${cascadeStr};`;
  };

  return _drop;
}
