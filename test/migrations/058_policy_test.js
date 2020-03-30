exports.up = async (pgm) => {
  await Promise.all([
    pgm.db.query("INSERT INTO tp(user_name) VALUES ('admin');"),
    pgm.db.query("INSERT INTO tp(user_name) VALUES ('alice');"),
    pgm.db.query("INSERT INTO tp(user_name) VALUES ('bob');"),
  ])
  await pgm.db.query('set role admin;')
  const { length: adminLength } = await pgm.db.select('SELECT * FROM tp;')
  if (adminLength !== 3) {
    throw new Error('Policy is not enforced')
  }
  await pgm.db.query('set role alice;')
  const { length: aliceLength } = await pgm.db.select('SELECT * FROM tp;')
  if (aliceLength !== 1) {
    throw new Error('Policy is not enforced')
  }
  await pgm.db.query('reset role;')
}

exports.down = () => null
