exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .query("SAVEPOINT sp_check;")
      .then(() => pgm.db.query("INSERT INTO td (d) VALUES (11);"))
      .then(() => reject(new Error("Check on domain was not set")))
      .catch(() => pgm.db.query("ROLLBACK TO SAVEPOINT sp_check;"))
      .then(resolve)
  );

exports.down = () => null;
