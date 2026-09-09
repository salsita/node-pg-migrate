import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import { isNameObject, isSchemaNameObject } from '../generalTypes';

export type RenameTypeFn = (typeName: Name, newTypeName: Name) => string;

export type RenameType = Reversible<RenameTypeFn>;

export function renameType(mOptions: MigrationOptions): RenameType {
  const rename = (source: Name, newName: Name, reverse = false): string => {
    const schema = isSchemaNameObject(source) ? source.schema : undefined;
    if (isSchemaNameObject(newName) && newName.schema !== schema) {
      throw new Error('renameType cannot change the schema of a type');
    }

    const oldName = isNameObject(source) ? source.name : source;
    const destination = isNameObject(newName) ? newName.name : newName;
    const newNameStr = mOptions.literal(destination);
    const sourceStr = reverse
      ? (schema ? `${mOptions.literal(schema)}.` : '') + newNameStr
      : mOptions.literal(source);
    const destinationStr = reverse ? mOptions.literal(oldName) : newNameStr;

    return `ALTER TYPE ${sourceStr} RENAME TO ${destinationStr};`;
  };

  const _rename: RenameType = (source, newName) => rename(source, newName);
  _rename.reverse = (source, newName) => rename(source, newName, true);

  return _rename;
}
