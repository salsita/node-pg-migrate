exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .query("SAVEPOINT sp_attr;")
      .then(() => pgm.db.query("select (ROW(1, 'x')::obj).str;"))
      .then(() => reject(new Error("Attribute was not removed")))
      .catch(() => pgm.db.query("ROLLBACK TO SAVEPOINT sp_attr;"))
      .then(resolve)
  );

exports.down = () => null;
