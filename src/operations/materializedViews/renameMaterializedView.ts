import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameMaterializedViewFn = (
  viewName: Name,
  newViewName: Name
) => string;

export type RenameMaterializedView = Reversible<RenameMaterializedViewFn>;

export function renameMaterializedView(
  mOptions: MigrationOptions
): RenameMaterializedView {
  const _rename: RenameMaterializedView = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };

  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);

  return _rename;
}
