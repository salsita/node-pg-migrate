import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';
import type { SequenceOptions } from './shared';
import { parseSequenceOptions } from './shared';

export interface SequenceOptionsAlter extends SequenceOptions {
  restart?: number | true;
}

export type AlterSequence = (
  sequenceName: Name,
  sequenceOptions: SequenceOptionsAlter
) => string | string[];

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

    return `ALTER SEQUENCE ${mOptions.literal(sequenceName)}
  ${clauses.join('\n  ')};`;
  };
}
