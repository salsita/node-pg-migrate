exports.up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_check;')
  try {
    await pgm.db.query('INSERT INTO t1(nmbr) VALUES (30);')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Missing check clause')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')
  }

  await pgm.db.query('INSERT INTO t1(nmbr) VALUES (21);')
}

exports.down = () => null
