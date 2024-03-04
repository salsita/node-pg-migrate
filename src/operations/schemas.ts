import type { MigrationOptions } from '../types';
import type { CreateSchema, DropSchema, RenameSchema } from './schemasTypes';

export type { CreateSchema, DropSchema, RenameSchema };

export function dropSchema(mOptions: MigrationOptions): DropSchema {
  const _drop: DropSchema = (schemaName, options = {}) => {
    const { ifExists, cascade } = options;
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const schemaNameStr = mOptions.literal(schemaName);
    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };

  return _drop;
}

export function createSchema(mOptions: MigrationOptions): CreateSchema {
  const _create: CreateSchema = (schemaName: string, options = {}) => {
    const { ifNotExists, authorization } = options;
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
