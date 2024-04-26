import type { MigrationOptions } from '../../types';
import type {
  DropOptions,
  IfNotExistsOption,
  Name,
  Reversible,
} from '../generalTypes';
import { dropSequence } from './dropSequence';
import type { SequenceOptions } from './shared';
import { parseSequenceOptions } from './shared';

export interface SequenceOptionsCreate
  extends SequenceOptions,
    IfNotExistsOption {
  temporary?: boolean;
}

export type CreateSequenceFn = (
  sequenceName: Name,
  sequenceOptions?: SequenceOptionsCreate & DropOptions
) => string;

export type CreateSequence = Reversible<CreateSequenceFn>;

export function createSequence(mOptions: MigrationOptions): CreateSequence {
  const _create: CreateSequence = (sequenceName, options = {}) => {
    const { temporary, ifNotExists } = options;

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const sequenceNameStr = mOptions.literal(sequenceName);
    const clausesStr = parseSequenceOptions(
      mOptions.typeShorthands,
      options
    ).join('\n  ');

    return `CREATE${temporaryStr} SEQUENCE${ifNotExistsStr} ${sequenceNameStr}
  ${clausesStr};`;
  };

  _create.reverse = dropSequence(mOptions);

  return _create;
}
