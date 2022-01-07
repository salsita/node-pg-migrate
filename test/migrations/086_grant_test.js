exports.up = async (pgm) => {
  // test table privileges
  const rows = await pgm.db.select(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants 
    WHERE table_name='table_for_bob'
    AND grantee = 'bob1'
  `)
  const rows1 = await pgm.db.select(`
    SELECT has_schema_privilege('bob1', 'test_schema', 'USAGE');
  `)
  console.log({ rows, rows1 })
  if (rows.length !== 7) {
    throw new Error('Incorrect number of priveleges')
  }
  const hasSchemaPrivilege = rows1.length && rows1[0].has_schema_privilege
  if (!hasSchemaPrivilege) {
    throw new Error('Bob should have a USAGE schema privelege')
  }
}

exports.down = () => null
