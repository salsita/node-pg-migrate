exports.comment = 'comment on table t2'

exports.up = (pgm) => {
  pgm.createTable('tmp', { id: 'id' }, { temporary: true })
}

exports.down = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_temp_table;')
  try {
    await pgm.db.query('DROP TABLE "tmp"')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Missing TEMPORARY clause')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_temp_table;')
  }
}
