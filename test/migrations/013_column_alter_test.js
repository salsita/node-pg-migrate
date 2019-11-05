exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_smallint;')
    .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (2147483647);'))
    .then(
      () => Promise.reject(new Error('Type not updated')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_smallint;')
    );

exports.down = () => null;
