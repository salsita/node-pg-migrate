import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameSequenceFn = (
  oldSequenceName: Name,
  newSequenceName: Name
) => string;

export type RenameSequence = Reversible<RenameSequenceFn>;

export function renameSequence(mOptions: MigrationOptions): RenameSequence {
  const _rename: RenameSequence = (sequenceName, newSequenceName) => {
    const sequenceNameStr = mOptions.literal(sequenceName);
    const newSequenceNameStr = mOptions.literal(newSequenceName);

    return `ALTER SEQUENCE ${sequenceNameStr} RENAME TO ${newSequenceNameStr};`;
  };

  _rename.reverse = (sequenceName, newSequenceName) =>
    _rename(newSequenceName, sequenceName);

  return _rename;
}
