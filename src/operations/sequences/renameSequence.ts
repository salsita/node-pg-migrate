import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameSequenceFn = (
  oldSequenceName: Name,
  newSequenceName: Name
) => string;

export type RenameSequence = Reversible<RenameSequenceFn>;

export function renameSequence(mOptions: MigrationOptions): RenameSequence {
  return createRenameOperation(mOptions, {
    operation: 'renameSequence',
    keyword: 'SEQUENCE',
    label: 'a sequence',
  });
}
