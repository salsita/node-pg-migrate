import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameColumnFn = (
  tableName: Name,
  oldColumnName: string,
  newColumnName: string
) => string | string[];

export type RenameColumn = RenameColumnFn & { reverse: RenameColumnFn };

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
