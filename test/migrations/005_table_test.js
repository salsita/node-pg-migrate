import * as table from './004_table.js';

const schema = process.env.SCHEMA || 'public';

export const up = async (pgm) => {
  const [{ comment }] = await pgm.db.select(
    `SELECT obj_description(c.oid) AS "comment"
          FROM pg_class c JOIN pg_namespace n ON (c.relnamespace = n.oid)
          WHERE c.relname = 't2' AND c.relkind = 'r' AND n.nspname = '${schema}'`
  );
  if (comment !== table.comment) {
    throw new Error('Comment not set');
  }

  await pgm.db.query('SAVEPOINT sp_reference;');
  try {
    await pgm.db.query('INSERT INTO t2(id2) VALUES (1);');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Missing reference clause');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_reference;');
  }

  await pgm.db.query('SAVEPOINT sp_not_null;');
  try {
    await pgm.db.query('INSERT INTO t1(created) VALUES (current_timestamp); ');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Missing not null clause');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_not_null;');
  }

  const {
    rows: [{ id }],
  } = await pgm.db.query(
    "INSERT INTO t1(string) VALUES ('something') RETURNING id;"
  );
  await pgm.db.query(`INSERT INTO t2(id2) VALUES (${id});`);
};

export const down = (pgm) => {
  pgm.sql('DELETE FROM t2');
  pgm.sql('DELETE FROM t1');
};
