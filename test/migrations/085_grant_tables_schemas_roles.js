exports.up = (pgm) => {
  pgm.createTable('table_for_bob', {
    id: 'id',
  })
  pgm.createRole('bob1')
  pgm.createRole('bob2')
  pgm.grantOnTables({
    privileges: 'ALL',
    tables: 'table_for_bob',
    roles: 'bob1',
  })
  pgm.createSchema('test_schema')
  pgm.grantOnSchemas({
    privileges: 'USAGE',
    schemas: 'test_schema',
    roles: 'bob1',
  })
  pgm.grantRoles('bob1', 'bob2')
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
