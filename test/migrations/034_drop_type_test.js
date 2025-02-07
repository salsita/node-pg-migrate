export const up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_drop;');
  try {
    await pgm.db.query('CREATE TEMPORARY TABLE t_list_3 (l list_for_drop);');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Type was not removed');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_drop;');
  }
};

export const down = () => null;
