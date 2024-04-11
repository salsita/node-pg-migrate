import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameMaterializedViewFn = (
  viewName: Name,
  newViewName: Name
) => string | string[];

export type RenameMaterializedView = RenameMaterializedViewFn & {
  reverse: RenameMaterializedViewFn;
};

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
