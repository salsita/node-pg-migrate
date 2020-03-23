exports.up = (pgm) =>
  pgm.db
    .query("INSERT INTO t1(string) VALUES ('something') RETURNING id;")
    .then(({ rows: [{ id }] }) => pgm.db.query(`INSERT INTO t2r(id2) VALUES (${id});`))

exports.down = () => null
