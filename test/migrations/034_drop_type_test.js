exports.up = pgm =>
  new Promise((resolve, reject) =>
    Promise.resolve()
      .then(() =>
        pgm.db
          .query("SAVEPOINT sp_drop;")
          .then(() =>
            pgm.db.query("CREATE TEMPORARY TABLE t_list_3 (l list_for_drop);")
          )
          .then(() => reject(new Error("Type was not removed")))
          .catch(() => pgm.db.query("ROLLBACK TO SAVEPOINT sp_drop;"))
      )
      .then(resolve)
  );

exports.down = () => null;
