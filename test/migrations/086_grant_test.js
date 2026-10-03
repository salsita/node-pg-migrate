import { constants } from './085_grant_tables_schemas_roles.js';

const {
  schema,
  table,
  sequence,
  role1,
  role2,
  tablePrivileges,
  sequencePrivileges,
  schemaPrivilege,
} = constants;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param role {string}
 * @param tableName {string}
 * @param privileges {string[]}
 */
const hasTablePrivileges = async (pgm, role, tableName, privileges) => {
  /** @type {Array<{ privilege_type: string }>} */
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

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param role {string}
 * @param sequenceName {string}
 * @param privileges {string[]}
 */
const hasSequencePrivileges = async (pgm, role, sequenceName, privileges) => {
  /** @type {Array<{ has_sequence_privilege: boolean }>} */
  const rows = await pgm.db.select(
    `SELECT has_sequence_privilege($1, $2, privilege)
    FROM unnest($3::text[]) AS privilege`,
    [role, sequenceName, privileges]
  );
  return (
    rows.length === privileges.length &&
    rows.every((row) => row.has_sequence_privilege)
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param role {string}
 * @param schemaName {string}
 * @param privilege {string}
 */
const hasSchemaPrivilege = async (pgm, role, schemaName, privilege) => {
  /** @type {Array<{ has_schema_privilege: boolean }>} */
  const rows = await pgm.db.select(`
    SELECT has_schema_privilege('${role}', '${schemaName}', '${privilege}');
  `);
  return rows.length > 0 && rows[0].has_schema_privilege;
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param role {string}
 * @param roleGroups {string[]}
 */
const isMemberOf = async (pgm, role, roleGroups) => {
  /** @type {Array<{ rolname: string }>} */
  const rows = await pgm.db.select(`
    SELECT rolname FROM pg_roles WHERE pg_has_role('${role}', oid, 'member') AND rolname <> '${role}';
  `);
  const foundRoleGroups = new Set(rows.map((entry) => entry.rolname));
  return roleGroups.reduce(
    (acc, roleGroup) => acc && foundRoleGroups.has(roleGroup),
    true
  );
};

export const utils = {
  hasTablePrivileges,
  hasSequencePrivileges,
  hasSchemaPrivilege,
  isMemberOf,
};

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

  const hasGrantedSequencePrivileges = await hasSequencePrivileges(
    pgm,
    role1,
    sequence,
    sequencePrivileges
  );

  if (!hasGrantedSequencePrivileges) {
    throw new Error(`${role1} misses granted sequence privileges`);
  }

  if (await hasSequencePrivileges(pgm, role1, sequence, ['UPDATE'])) {
    throw new Error(`${role1} has an unrequested UPDATE sequence privilege`);
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
