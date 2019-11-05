exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_check;')
    .then(() => pgm.db.query('INSERT INTO td (d) VALUES (11);'))
    .then(
      () => Promise.reject(new Error('Check on domain was not set')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')
    );

exports.down = () => null;
