const {
  constants: { schema, table, role1, role2, tablePrivileges, schemaPrivilege },
} = require('./085_grant_tables_schemas_roles.cjs');

exports.up = (pgm) => {
  pgm.revokeRoles(role1, role2);
  pgm.revokeOnSchemas({
    privileges: schemaPrivilege,
    schemas: schema,
    roles: role1,
  });
  pgm.revokeOnTables({
    privileges: tablePrivileges,
    tables: table,
    roles: role1,
  });
};

exports.down = () => null;
