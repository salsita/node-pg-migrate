import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameTableFn = (tableName: Name, newtableName: Name) => string;

export type RenameTable = Reversible<RenameTableFn>;

export function renameTable(mOptions: MigrationOptions): RenameTable {
  return createRenameOperation(mOptions, {
    operation: 'renameTable',
    keyword: 'TABLE',
    label: 'a table',
  });
}
