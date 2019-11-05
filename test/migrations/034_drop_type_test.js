exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_drop;')
    .then(() =>
      pgm.db.query('CREATE TEMPORARY TABLE t_list_3 (l list_for_drop);')
    )
    .then(
      () => Promise.reject(new Error('Type was not removed')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_drop;')
    );

exports.down = () => null;
