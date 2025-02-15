export const up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_attr;');
  try {
    await pgm.db.query("SELECT (ROW(1, 'x')::obj).str;");
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Attribute was not removed');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_attr;');
  }
};

export const down = () => null;
