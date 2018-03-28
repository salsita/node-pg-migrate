import { template } from "../utils";

export const dropSchema = (schemaName, { ifExists, cascade } = {}) =>
  template`DROP SCHEMA${ifExists ? " IF EXISTS" : ""} "${schemaName}"${
    cascade ? " CASCADE" : ""
  };`;

export const createSchema = (schemaName, { ifNotExists, authorization } = {}) =>
  template`CREATE SCHEMA${ifNotExists ? " IF NOT EXISTS" : ""} "${schemaName}"${
    authorization ? ` AUTHORIZATION ${authorization}` : ""
  };`;

// RENAME
export const renameSchema = (schemaName, newSchemaName) =>
  template`ALTER SCHEMA  "${schemaName}" RENAME TO "${newSchemaName}";`;

const undoRename = (schemaName, newSchemaName) =>
  renameSchema(newSchemaName, schemaName);

createSchema.reverse = dropSchema;
renameSchema.reverse = undoRename;
