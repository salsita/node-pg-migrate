exports.up = pgm =>
  new Promise((resolve, reject) =>
    Promise.resolve()
      .then(() =>
        pgm.db
          .query('SAVEPOINT sp_smallint;')
          .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (2147483647);'))
          .then(() => reject(new Error('Type not updated')))
          .catch(() => pgm.db.query('ROLLBACK TO SAVEPOINT sp_smallint;'))
      )
      .then(resolve)
  );

exports.down = () => null;
