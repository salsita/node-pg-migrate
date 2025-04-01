import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameColumnFn = (
  tableName: Name,
  oldColumnName: string,
  newColumnName: string
) => string;

export type RenameColumn = Reversible<RenameColumnFn>;

export function renameColumn(mOptions: MigrationOptions): RenameColumn {
  const _rename: RenameColumn = (tableName, columnName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const columnNameStr = mOptions.literal(columnName);
    const newNameStr = mOptions.literal(newName);

    return `ALTER TABLE ${tableNameStr} RENAME ${columnNameStr} TO ${newNameStr};`;
  };

  _rename.reverse = (tableName, columnName, newName) =>
    _rename(tableName, newName, columnName);

  return _rename;
}
