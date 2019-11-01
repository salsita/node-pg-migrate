function dropSchema(mOptions) {
  const _drop = (schemaName, { ifExists, cascade } = {}) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const schemaNameStr = mOptions.literal(schemaName);
    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };
  return _drop;
}

function createSchema(mOptions) {
  const _create = (schemaName, { ifNotExists, authorization } = {}) => {
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

function renameSchema(mOptions) {
  const _rename = (schemaName, newSchemaName) => {
    const schemaNameStr = mOptions.literal(schemaName);
    const newSchemaNameStr = mOptions.literal(newSchemaName);
    return `ALTER SCHEMA ${schemaNameStr} RENAME TO ${newSchemaNameStr};`;
  };
  _rename.reverse = (schemaName, newSchemaName) =>
    _rename(newSchemaName, schemaName);
  return _rename;
}

module.exports = {
  createSchema,
  dropSchema,
  renameSchema
};
