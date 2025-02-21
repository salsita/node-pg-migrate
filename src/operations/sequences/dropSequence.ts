import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropSequenceOptions = DropOptions;

export type DropSequence = (
  sequenceName: Name,
  dropOptions?: DropSequenceOptions
) => string;

export function dropSequence(mOptions: MigrationOptions): DropSequence {
  const _drop: DropSequence = (sequenceName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const sequenceNameStr = mOptions.literal(sequenceName);

    return `DROP SEQUENCE${ifExistsStr} ${sequenceNameStr}${cascadeStr};`;
  };

  return _drop;
}
