import { constants } from './085_grant_tables_schemas_roles.js';

const { schema, table, role1, role2, tablePrivileges, schemaPrivilege } =
  constants;

export const up = (pgm) => {
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

export const down = () => null;
