import type { MigrationOptions } from '../../migrationOptions';
import { formatSeparator } from '../../utils';
import type { Name } from '../generalTypes';
import type { SequenceOptions } from './shared';
import { parseSequenceOptions } from './shared';

export interface AlterSequenceOptions extends SequenceOptions {
  restart?: number | true;
}

export type AlterSequence = (
  sequenceName: Name,
  sequenceOptions: AlterSequenceOptions
) => string;

export function alterSequence(mOptions: MigrationOptions): AlterSequence {
  return (sequenceName, options) => {
    const { restart } = options;

    const clauses = parseSequenceOptions(mOptions.typeShorthands, options);

    if (restart) {
      if (restart === true) {
        clauses.push('RESTART');
      } else {
        clauses.push(`RESTART WITH ${restart}`);
      }
    }

    if (clauses.length === 0) {
      throw new Error('No sequence options provided for alterSequence');
    }

    const nl = formatSeparator(mOptions.pretty, '  ');
    const clausesStr = clauses.join(nl);

    return `ALTER SEQUENCE ${mOptions.literal(sequenceName)}${nl}${clausesStr};`;
  };
}
