import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameMaterializedViewFn = (
  viewName: Name,
  newViewName: Name
) => string;

export type RenameMaterializedView = Reversible<RenameMaterializedViewFn>;

export function renameMaterializedView(
  mOptions: MigrationOptions
): RenameMaterializedView {
  return createRenameOperation(mOptions, {
    operation: 'renameMaterializedView',
    keyword: 'MATERIALIZED VIEW',
    label: 'a materialized view',
  });
}
