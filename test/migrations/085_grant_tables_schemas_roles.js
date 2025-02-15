const schema = 'test_grant_schema';
const table = 'test_grant_table';
const role1 = 'test_grant_bob1';
const role2 = 'test_grant_bob2';
const tablePrivileges = ['SELECT', 'UPDATE'];
const schemaPrivilege = 'USAGE';

export const constants = {
  schema,
  table,
  role1,
  role2,
  tablePrivileges,
  schemaPrivilege,
};

export const up = (pgm) => {
  pgm.createTable(table, {
    id: 'id',
  });
  pgm.createRole(role1);
  pgm.createRole(role2);
  pgm.grantOnTables({
    privileges: tablePrivileges,
    tables: table,
    roles: role1,
  });
  pgm.createSchema(schema);
  pgm.grantOnSchemas({
    privileges: schemaPrivilege,
    schemas: schema,
    roles: role1,
  });
  pgm.grantRoles(role1, role2);
};

export const down = () => null;
