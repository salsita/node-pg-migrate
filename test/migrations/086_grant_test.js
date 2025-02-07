import { constants } from './085_grant_tables_schemas_roles.js';

const { schema, table, role1, role2, tablePrivileges, schemaPrivilege } =
  constants;

const hasTablePrivileges = async (pgm, role, tableName, privileges) => {
  const rows = await pgm.db.select(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_name='${tableName}'
    AND grantee = '${role}'
  `);
  const foundPrivileges = new Set(rows.map((entry) => entry.privilege_type));
  return privileges.reduce(
    (acc, privilege) => acc && foundPrivileges.has(privilege),
    true
  );
};

const hasSchemaPrivilege = async (pgm, role, schemaName, privilege) => {
  const rows = await pgm.db.select(`
    SELECT has_schema_privilege('${role}', '${schemaName}', '${privilege}');
  `);
  return rows.length > 0 && rows[0].has_schema_privilege;
};

const isMemberOf = async (pgm, role, roleGroups) => {
  const rows = await pgm.db.select(`
    SELECT rolname FROM pg_roles WHERE pg_has_role('${role}', oid, 'member') AND rolname <> '${role}';
  `);
  const foundRoleGroups = new Set(rows.map((entry) => entry.rolname));
  return roleGroups.reduce(
    (acc, roleGroup) => acc && foundRoleGroups.has(roleGroup),
    true
  );
};

export const utils = { hasTablePrivileges, hasSchemaPrivilege, isMemberOf };

export const up = async (pgm) => {
  const hasGrantedTablePrivileges = await hasTablePrivileges(
    pgm,
    role1,
    table,
    tablePrivileges
  );

  if (!hasGrantedTablePrivileges) {
    throw new Error(`${role1} misses granted table privileges`);
  }

  const hasGrantedSchemaPrivilege = await hasSchemaPrivilege(
    pgm,
    role1,
    schema,
    schemaPrivilege
  );

  if (!hasGrantedSchemaPrivilege) {
    throw new Error(`${role1} misses ${schemaPrivilege} schema privilege`);
  }

  const isMemberOfRole1 = await isMemberOf(pgm, role2, [role1]);

  if (!isMemberOfRole1) {
    throw new Error(`${role2} is not a member of ${role1}`);
  }
};

export const down = () => null;
