import { template } from "../utils";

export const dropSchema = (schemaName, { ifExists, cascade } = {}) => {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP SCHEMA${ifExistsStr} "${schemaName}"${cascadeStr};`;
};

export const createSchema = (
  schemaName,
  { ifNotExists, authorization } = {}
) => {
  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  const authorizationStr = authorization
    ? ` AUTHORIZATION ${authorization}`
    : "";
  return template`CREATE SCHEMA${ifNotExistsStr} "${schemaName}"${authorizationStr};`;
};

export const renameSchema = (schemaName, newSchemaName) =>
  template`ALTER SCHEMA  "${schemaName}" RENAME TO "${newSchemaName}";`;

const undoRename = (schemaName, newSchemaName) =>
  renameSchema(newSchemaName, schemaName);

createSchema.reverse = dropSchema;
renameSchema.reverse = undoRename;
