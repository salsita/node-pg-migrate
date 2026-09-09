import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameViewFn = (viewName: Name, newViewName: Name) => string;

export type RenameView = Reversible<RenameViewFn>;

export function renameView(mOptions: MigrationOptions): RenameView {
  return createRenameOperation(mOptions, {
    operation: 'renameView',
    keyword: 'VIEW',
    label: 'a view',
  });
}
