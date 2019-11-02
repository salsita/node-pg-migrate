import { DropOptions, Name } from '../definitions';
import { MigrationOptions } from '../migration-builder';

export function dropSchema(mOptions: MigrationOptions) {
  const _drop = (
    schemaName: string,
    { ifExists, cascade }: DropOptions = {}
  ) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const schemaNameStr = mOptions.literal(schemaName);
    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };
  return _drop;
}

export function createSchema(mOptions: MigrationOptions) {
  const _create = (
    schemaName: string,
    {
      ifNotExists,
      authorization
    }: {
      ifNotExists?: boolean;
      authorization?: string;
    } = {}
  ) => {
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const schemaNameStr = mOptions.literal(schemaName);
    const authorizationStr = authorization
      ? ` AUTHORIZATION ${authorization}`
      : '';
    return `CREATE SCHEMA${ifNotExistsStr} ${schemaNameStr}${authorizationStr};`;
  };
  _create.reverse = dropSchema(mOptions);
  return _create;
}

export function renameSchema(mOptions: MigrationOptions) {
  const _rename = (schemaName: Name, newSchemaName: Name) => {
    const schemaNameStr = mOptions.literal(schemaName);
    const newSchemaNameStr = mOptions.literal(newSchemaName);
    return `ALTER SCHEMA ${schemaNameStr} RENAME TO ${newSchemaNameStr};`;
  };
  _rename.reverse = (schemaName: Name, newSchemaName: Name) =>
    _rename(newSchemaName, schemaName);
  return _rename;
}
