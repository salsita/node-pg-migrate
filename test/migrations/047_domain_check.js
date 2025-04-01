export const up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_check;');
  try {
    await pgm.db.query('INSERT INTO td (d) VALUES (11);');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Check on domain was not set');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;');
  }
};

export const down = () => null;
