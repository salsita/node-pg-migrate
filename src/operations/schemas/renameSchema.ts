import type { MigrationOptions } from '../../migrationOptions';
import type { Reversible } from '../generalTypes';

export type RenameSchemaFn = (
  oldSchemaName: string,
  newSchemaName: string
) => string;

export type RenameSchema = Reversible<RenameSchemaFn>;

export function renameSchema(mOptions: MigrationOptions): RenameSchema {
  const _rename: RenameSchema = (schemaName, newSchemaName) => {
    const schemaNameStr = mOptions.literal(schemaName);
    const newSchemaNameStr = mOptions.literal(newSchemaName);

    return `ALTER SCHEMA ${schemaNameStr} RENAME TO ${newSchemaNameStr};`;
  };

  _rename.reverse = (schemaName, newSchemaName) =>
    _rename(newSchemaName, schemaName);

  return _rename;
}
