const {
  constants: { schema, table, role1, role2, tablePrivileges, schemaPrivilege },
} = require('./085_grant_tables_schemas_roles')

const hasTablePrivileges = async (pgm, role, tableName, privileges) => {
  const rows = await pgm.db.select(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants 
    WHERE table_name='${tableName}'
    AND grantee = '${role}'
  `)
  const foundPrivileges = rows.map(({ privilegeType }) => privilegeType)
  console.log(foundPrivileges, privileges)
  return privileges.reduce((acc, privilege) => acc && foundPrivileges.includes(privilege), true)
}

const hasSchemaPrivilege = async (pgm, role, schemaName, privilege) => {
  const rows = await pgm.db.select(`
    SELECT has_schema_privilege('${role}', '${schemaName}', '${privilege}');
  `)
  return rows.length && rows[0].has_schema_privilege
}

const checkGrantedPrivileges = async (pgm, role) => {
  const hasGrantedTablePrivileges = await hasTablePrivileges(pgm, role, table, tablePrivileges)
  if (!hasGrantedTablePrivileges) {
    throw new Error(`${role} misses granted table privileges`)
  }
  const hasGrantedSchemaPrivilege = await hasSchemaPrivilege(pgm, role, schema, schemaPrivilege)
  if (!hasGrantedSchemaPrivilege) {
    throw new Error(`${role} misses USAGE schema privilege`)
  }
}

exports.up = async (pgm) => {
  await checkGrantedPrivileges(pgm, role1)
  await checkGrantedPrivileges(pgm, role2)
}

exports.down = () => null
