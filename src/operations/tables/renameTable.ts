import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import { isNameObject, isSchemaNameObject } from '../generalTypes';

export type RenameTableFn = (tableName: Name, newtableName: Name) => string;

export type RenameTable = Reversible<RenameTableFn>;

export function renameTable(mOptions: MigrationOptions): RenameTable {
  const rename = (tableName: Name, newName: Name, reverse = false): string => {
    const schema = isSchemaNameObject(tableName) ? tableName.schema : undefined;
    if (isSchemaNameObject(newName) && newName.schema !== schema) {
      throw new Error('renameTable cannot change the schema of a table');
    }

    const oldName = isNameObject(tableName) ? tableName.name : tableName;
    const destination = isNameObject(newName) ? newName.name : newName;
    const newNameStr = mOptions.literal(destination);
    const tableNameStr = reverse
      ? (schema ? `${mOptions.literal(schema)}.` : '') + newNameStr
      : mOptions.literal(tableName);
    const destinationStr = reverse ? mOptions.literal(oldName) : newNameStr;

    return `ALTER TABLE ${tableNameStr} RENAME TO ${destinationStr};`;
  };

  const _rename: RenameTable = (tableName, newName) =>
    rename(tableName, newName);
  _rename.reverse = (tableName, newName) => rename(tableName, newName, true);

  return _rename;
}
