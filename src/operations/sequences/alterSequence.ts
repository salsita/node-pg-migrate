import type { MigrationOptions } from '../../migrationOptions';
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

    return `ALTER SEQUENCE ${mOptions.literal(sequenceName)}
  ${clauses.join('\n  ')};`;
  };
}
