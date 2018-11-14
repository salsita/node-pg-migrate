const table = require("./004_table");

exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select(
        `SELECT obj_description(c.oid) as "comment"
                FROM pg_class c join pg_namespace n ON (c.relnamespace = n.oid)
                WHERE c.relname = 't2' and c.relkind = 'r' and n.nspname = 'public'`
      )
      .then(([{ comment }]) =>
        comment === table.comment ? null : reject(new Error("Comment not set"))
      )
      .then(() => pgm.db.query("SAVEPOINT sp_reference;"))
      .then(() => pgm.db.query("INSERT INTO t2(id2) VALUES (1);"))
      .then(() => reject(new Error("Missing reference clause")))
      .catch(() => pgm.db.query("ROLLBACK TO SAVEPOINT sp_reference;"))
      .then(() => pgm.db.query("SAVEPOINT sp_not_null;"))
      .then(() =>
        pgm.db.query("INSERT INTO t1(created) VALUES (current_timestamp); ")
      )
      .then(() => reject(new Error("Missing not null clause")))
      .catch(() => pgm.db.query("ROLLBACK TO SAVEPOINT sp_not_null;"))
      .then(() =>
        pgm.db.query(
          "INSERT INTO t1(string) VALUES ('something') RETURNING id;"
        )
      )
      .then(({ rows: [{ id }] }) =>
        pgm.db.query(`INSERT INTO t2(id2) VALUES (${id});`)
      )
      .then(resolve)
  );

exports.down = pgm => {
  pgm.sql("DELETE from t2");
  pgm.sql("DELETE from t1");
};
