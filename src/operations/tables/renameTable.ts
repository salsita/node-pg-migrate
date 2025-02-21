import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameTableFn = (tableName: Name, newtableName: Name) => string;

export type RenameTable = Reversible<RenameTableFn>;

export function renameTable(mOptions: MigrationOptions): RenameTable {
  const _rename: RenameTable = (tableName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const newNameStr = mOptions.literal(newName);

    return `ALTER TABLE ${tableNameStr} RENAME TO ${newNameStr};`;
  };

  _rename.reverse = (tableName, newName) => _rename(newName, tableName);

  return _rename;
}
