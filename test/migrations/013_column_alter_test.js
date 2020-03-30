exports.up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_smallint;')
  try {
    await pgm.db.query('INSERT INTO t1(nmbr) VALUES (2147483647);')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Type not updated')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_smallint;')
  }
}

exports.down = () => null
