exports.up = pgm =>
  pgm.db
    .query('SAVEPOINT sp_attr;')
    .then(() => pgm.db.query("select (ROW(1, 'x')::obj).str;"))
    .then(
      () => Promise.reject(new Error('Attribute was not removed')),
      () => pgm.db.query('ROLLBACK TO SAVEPOINT sp_attr;')
    );

exports.down = () => null;
