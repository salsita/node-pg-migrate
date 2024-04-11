import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameMaterializedViewColumnFn = (
  viewName: Name,
  columnName: string,
  newColumnName: string
) => string | string[];

export type RenameMaterializedViewColumn = RenameMaterializedViewColumnFn & {
  reverse: RenameMaterializedViewColumnFn;
};

export function renameMaterializedViewColumn(
  mOptions: MigrationOptions
): RenameMaterializedViewColumn {
  const _rename: RenameMaterializedViewColumn = (
    viewName,
    columnName,
    newColumnName
  ) => {
    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);
    const newColumnNameStr = mOptions.literal(newColumnName);

    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME COLUMN ${columnNameStr} TO ${newColumnNameStr};`;
  };

  _rename.reverse = (viewName, columnName, newColumnName) =>
    _rename(viewName, newColumnName, columnName);

  return _rename;
}
