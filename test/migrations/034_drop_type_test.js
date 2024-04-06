exports.up = async (pgm) => {
  await pgm.db.query('SAVEPOINT sp_drop;');
  try {
    await pgm.db.query('CREATE TEMPORARY TABLE t_list_3 (l list_for_drop);');
    throw 1;
  } catch (err) {
    if (err === 1) {
      throw new Error('Type was not removed');
    }

    await pgm.db.query('ROLLBACK TO SAVEPOINT sp_drop;');
  }
};

exports.down = () => null;
