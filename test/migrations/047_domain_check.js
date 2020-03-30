exports.up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_check;')
  try {
    await pgm.db.query('INSERT INTO td (d) VALUES (11);')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Check on domain was not set')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')
  }
}

exports.down = () => null
