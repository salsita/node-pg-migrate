exports.up = async (pgm) => {
  // test table privileges
  const rows = await pgm.db.select(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants 
    WHERE table_name='table_for_bob'
    AND grantee = 'bob1'
  `)
  const rows1 = await pgm.db.select(`
    SELECT n.nspacl AS "Access privileges"
    FROM pg_catalog.pg_namespace n
    WHERE n.nspname !~ '^pg_' AND n.nspname = 'test_schema';
  `)
  console.log({ rows, rows1 })
  if (rows.length !== 7) {
    throw new Error('Incorrect number of priveleges')
  }
}

exports.down = () => null
