import type { MigrationOptions } from '../migrationOptions';
import type { Name, Reversible } from './generalTypes';
import { isNameObject, isSchemaNameObject } from './generalTypes';

type RenameFn = (source: Name, destination: Name) => string;

interface RenameOptions {
  operation: string;
  keyword: string;
  label: string;
}

/** Creates the reversible pair for an object renamed within its schema. */
export function createRenameOperation(
  mOptions: MigrationOptions,
  { operation, keyword, label }: RenameOptions
): Reversible<RenameFn> {
  const validateSchema = (source: Name, destination: Name) => {
    const schema = isSchemaNameObject(source) ? source.schema : undefined;
    if (isSchemaNameObject(destination) && destination.schema !== schema) {
      throw new Error(`${operation} cannot change the schema of ${label}`);
    }
    return schema;
  };

  const rename: RenameFn = (source, destination) => {
    validateSchema(source, destination);
    const newName = isNameObject(destination) ? destination.name : destination;
    const destinationSql = mOptions.literal(newName);
    const sourceSql = mOptions.literal(source);
    return `ALTER ${keyword} ${sourceSql} RENAME TO ${destinationSql};`;
  };

  const reverse: RenameFn = (source, destination) => {
    const schema = validateSchema(source, destination);
    const oldName = isNameObject(source) ? source.name : source;
    const newName = isNameObject(destination) ? destination.name : destination;
    const newNameSql = mOptions.literal(newName);
    const sourceSql =
      (schema ? `${mOptions.literal(schema)}.` : '') + newNameSql;
    const destinationSql = mOptions.literal(oldName);
    return `ALTER ${keyword} ${sourceSql} RENAME TO ${destinationSql};`;
  };

  return Object.assign(rename, { reverse });
}
