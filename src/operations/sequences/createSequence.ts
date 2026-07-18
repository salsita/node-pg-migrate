import type { MigrationOptions } from '../../migrationOptions';
import { formatSeparator } from '../../utils';
import type { IfNotExistsOption, Name, Reversible } from '../generalTypes';
import type { DropSequenceOptions } from './dropSequence';
import { dropSequence } from './dropSequence';
import type { SequenceOptions } from './shared';
import { parseSequenceOptions } from './shared';

export interface CreateSequenceOptions
  extends SequenceOptions, IfNotExistsOption {
  temporary?: boolean;
}

export type CreateSequenceFn = (
  sequenceName: Name,
  sequenceOptions?: CreateSequenceOptions & DropSequenceOptions
) => string;

export type CreateSequence = Reversible<CreateSequenceFn>;

export function createSequence(mOptions: MigrationOptions): CreateSequence {
  const _create: CreateSequence = (sequenceName, options = {}) => {
    const { temporary = false, ifNotExists = false } = options;

    const temporaryStr = temporary ? ' TEMPORARY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const sequenceNameStr = mOptions.literal(sequenceName);
    const nl = formatSeparator(mOptions.pretty, '  ');
    const clauses = parseSequenceOptions(mOptions.typeShorthands, options);
    const clausesStr = clauses.join(nl);
    const clausesSuffix = clausesStr ? `${nl}${clausesStr}` : '';

    return `CREATE${temporaryStr} SEQUENCE${ifNotExistsStr} ${sequenceNameStr}${clausesSuffix};`;
  };

  _create.reverse = dropSequence(mOptions);

  return _create;
}
