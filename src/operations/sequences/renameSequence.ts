import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import { isNameObject, isSchemaNameObject } from '../generalTypes';

export type RenameSequenceFn = (
  oldSequenceName: Name,
  newSequenceName: Name
) => string;

export type RenameSequence = Reversible<RenameSequenceFn>;

export function renameSequence(mOptions: MigrationOptions): RenameSequence {
  const rename = (source: Name, newName: Name, reverse = false): string => {
    const schema = isSchemaNameObject(source) ? source.schema : undefined;
    if (isSchemaNameObject(newName) && newName.schema !== schema) {
      throw new Error('renameSequence cannot change the schema of a sequence');
    }

    const oldName = isNameObject(source) ? source.name : source;
    const destination = isNameObject(newName) ? newName.name : newName;
    const newNameStr = mOptions.literal(destination);
    const sourceStr = reverse
      ? (schema ? `${mOptions.literal(schema)}.` : '') + newNameStr
      : mOptions.literal(source);
    const destinationStr = reverse ? mOptions.literal(oldName) : newNameStr;

    return `ALTER SEQUENCE ${sourceStr} RENAME TO ${destinationStr};`;
  };

  const _rename: RenameSequence = (source, newName) => rename(source, newName);
  _rename.reverse = (source, newName) => rename(source, newName, true);

  return _rename;
}
