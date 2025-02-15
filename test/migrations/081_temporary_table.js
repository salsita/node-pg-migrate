export const comment = 'comment on table t2';

export const up = (pgm) => {
  pgm.createTable('tmp', { id: 'id' }, { temporary: true });
};

export const down = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_temp_table;');
  try {
    await pgm.db.query('DROP TABLE "tmp"');
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 1;
  } catch (error) {
    if (error === 1) {
      throw new Error('Missing TEMPORARY clause');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_temp_table;');
  }
};
