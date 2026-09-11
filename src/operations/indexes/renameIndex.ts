import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameIndexFn = (name: Name, newName: Name) => string;
export type RenameIndex = Reversible<RenameIndexFn>;

export function renameIndex(mOptions: MigrationOptions): RenameIndex {
  return createRenameOperation(mOptions, {
    operation: 'renameIndex',
    keyword: 'INDEX',
    label: 'an index',
  });
}
