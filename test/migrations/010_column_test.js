exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db.query('SAVEPOINT sp_check;')
      .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (1);'))
      .then(() => reject(new Error('Missing check clause')))
      .catch(() => pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;'))
      .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (20);'))
      .then(() => pgm.db.query('SAVEPOINT sp_unique;'))
      .then(() => pgm.db.query('INSERT INTO t1(nr) VALUES (20);'))
      .then(() => reject(new Error('Missing not unique clause')))
      .catch(() => pgm.db.query('ROLLBACK TO SAVEPOINT sp_unique;'))
      .then(resolve)
  );

exports.down = () => null;
