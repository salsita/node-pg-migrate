const { template } = require("../utils");

function dropSchema(schemaName, { ifExists, cascade } = {}) {
  const ifExistsStr = ifExists ? " IF EXISTS" : "";
  const cascadeStr = cascade ? " CASCADE" : "";
  return template`DROP SCHEMA${ifExistsStr} "${schemaName}"${cascadeStr};`;
}

function createSchema(schemaName, { ifNotExists, authorization } = {}) {
  const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
  const authorizationStr = authorization
    ? ` AUTHORIZATION ${authorization}`
    : "";
  return template`CREATE SCHEMA${ifNotExistsStr} "${schemaName}"${authorizationStr};`;
}

function renameSchema(schemaName, newSchemaName) {
  return template`ALTER SCHEMA  "${schemaName}" RENAME TO "${newSchemaName}";`;
}

const undoRename = (schemaName, newSchemaName) =>
  renameSchema(newSchemaName, schemaName);

createSchema.reverse = dropSchema;
renameSchema.reverse = undoRename;

module.exports = {
  createSchema,
  dropSchema,
  renameSchema
};
