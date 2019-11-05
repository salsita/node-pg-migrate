exports.up = pgm =>
  Promise.resolve()
    .then(() =>
      pgm.db
        .query('SAVEPOINT sp_check;')
        .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (1);'))
        .then(
          () => Promise.reject(new Error('Missing check clause')),
          () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')
        )
    )
    .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (20);'))
    .then(() =>
      pgm.db
        .query('SAVEPOINT sp_unique;')
        .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (20);'))
        .then(
          () => Promise.reject(new Error('Missing not unique clause')),
          () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_unique;')
        )
    );

exports.down = () => null;
