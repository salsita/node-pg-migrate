exports.up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_attr;')
  try {
    await pgm.db.query("select (ROW(1, 'x')::obj).str;")
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Attribute was not removed')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_attr;')
  }
}

exports.down = () => null
