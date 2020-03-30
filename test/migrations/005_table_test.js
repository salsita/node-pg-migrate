const table = require('./004_table')

const schema = process.env.SCHEMA || 'public'

exports.up = async (pgm) => {
  const [{ comment }] = await pgm.db.select(
    `SELECT obj_description(c.oid) as "comment"
          FROM pg_class c join pg_namespace n ON (c.relnamespace = n.oid)
          WHERE c.relname = 't2' and c.relkind = 'r' and n.nspname = '${schema}'`,
  )
  if (comment !== table.comment) {
    throw new Error('Comment not set')
  }

  await pgm.db.query('SAVEPOINT sp_reference;')
  try {
    await pgm.db.query('INSERT INTO t2(id2) VALUES (1);')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Missing reference clause')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_reference;')
  }

  await pgm.db.query('SAVEPOINT sp_not_null;')
  try {
    await pgm.db.query('INSERT INTO t1(created) VALUES (current_timestamp); ')
    throw 1 // eslint-disable-line no-throw-literal
  } catch (err) {
    if (err === 1) {
      throw new Error('Missing not null clause')
    }
    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_not_null;')
  }

  const {
    rows: [{ id }],
  } = await pgm.db.query("INSERT INTO t1(string) VALUES ('something') RETURNING id;")
  await pgm.db.query(`INSERT INTO t2(id2) VALUES (${id});`)
}

exports.down = (pgm) => {
  pgm.sql('DELETE from t2')
  pgm.sql('DELETE from t1')
}
