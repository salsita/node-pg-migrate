exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_check;')
    .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (30);'))
    .then(
      () => Promise.reject(new Error('Missing check clause')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')
    )
    .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (21);'));

exports.down = () => null;
