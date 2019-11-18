exports.up = pgm =>
  new Promise((resolve, reject) =>
    Promise.resolve()
      .then(() =>
        pgm.db
          .query('SAVEPOINT sp_check;')
          .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (30);'))
          .then(() => reject(new Error('Missing check clause')))
          .catch(() => pgm.db.query('ROLLBACK TO SAVEPOINT sp_check;')),
      )
      .then(() => pgm.db.query('INSERT INTO t1(nmbr) VALUES (21);'))
      .then(resolve),
  )

exports.down = () => null
