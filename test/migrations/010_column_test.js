export const up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_check;');
  try {
    await pgm.db.query('INSERT INTO t1(nr) VALUES (1);');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Missing check clause');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;');
  }

  await pgm.db.query('INSERT INTO t1(nr) VALUES (20);');

  await pgm.db.query('SAVEPOINT sp_unique;');
  try {
    await pgm.db.query('INSERT INTO t1(nr) VALUES (20);');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Missing not unique clause');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_unique;');
  }
};

export const down = () => null;
