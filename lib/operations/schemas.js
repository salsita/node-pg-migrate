import { template } from '../utils';

export const drop = (schemaName, { ifExists, cascade } = {}) =>
  template`DROP SCHEMA${ifExists ? ' IF EXISTS' : ''} "${schemaName}"${cascade ? ' CASCADE' : ''};`;

export const create = (schemaName, { ifNotExists, authorization } = {}) =>
  template`CREATE SCHEMA${ifNotExists ? ' IF NOT EXISTS' : ''} "${schemaName}"${authorization ? ` AUTHORIZATION ${authorization}` : ''};`;

// RENAME
export const rename = (schemaName, newSchemaName) =>
  template`ALTER SCHEMA  "${schemaName}" RENAME TO "${newSchemaName}";`;

export const undoRename = (schemaName, newSchemaName) =>
  rename(newSchemaName, schemaName);

create.reverse = drop;
rename.reverse = undoRename;
