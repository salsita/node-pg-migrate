exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_smallint;')
    .then(() => pgm.db.query("select (ROW(2147483647, 'x')::obj).id;"))
    .then(
      () => Promise.reject(new Error('Type not updated')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_smallint;')
    );

exports.down = () => null;
