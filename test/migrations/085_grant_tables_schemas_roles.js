const schema = 'test_grant_schema'
const table = 'test_grant_table'
const role1 = 'test_grant_bob1'
const role2 = 'test_grant_bob2'
const tablePrivileges = ['SELECT', 'UPDATE']
const schemaPrivilege = 'USAGE'

exports.constants = { schema, table, role1, role2, tablePrivileges, schemaPrivilege }

exports.up = (pgm) => {
  pgm.createTable(table, {
    id: 'id',
  })
  pgm.createRole(role1)
  pgm.createRole(role2)
  pgm.grantOnTables({
    privileges: tablePrivileges,
    tables: table,
    roles: role1,
  })
  pgm.createSchema(schema)
  pgm.grantOnSchemas({
    privileges: schemaPrivilege,
    schemas: schema,
    roles: role1,
  })
  pgm.grantRoles(role1, role2)
}

// Test table privileges
/*
  SELECT grantee, privilege_type 
  FROM information_schema.role_table_grants 
  WHERE table_name='Games' AND grantee = 'test2'

  // table privileges
  SELECT grantor, grantee, table_schema, table_name, privilege_type
  FROM information_schema.table_privileges
  WHERE grantee = 'myuser'

  // schema information
  SELECT n.nspname AS "Name",
    pg_catalog.pg_get_userbyid(n.nspowner) AS "Owner",
    pg_catalog.array_to_string(n.nspacl, E'\n') AS "Access privileges",
    pg_catalog.obj_description(n.oid, 'pg_namespace') AS "Description"
  FROM pg_catalog.pg_namespace n
  WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
  ORDER BY 1;

  // concrete schema
  SELECT n.nspacl AS "Access privileges"
  FROM pg_catalog.pg_namespace n
  WHERE n.nspname !~ '^pg_' AND n.nspname = 'hollywood';
 */
