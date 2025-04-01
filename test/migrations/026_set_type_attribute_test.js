export const up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_smallint;');
  try {
    await pgm.db.query("SELECT (ROW(2147483647, 'x')::obj).id;");
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Type not updated');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_smallint;');
  }
};

export const down = () => null;
