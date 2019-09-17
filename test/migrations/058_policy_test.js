exports.up = pgm =>
  new Promise((resolve, reject) =>
    Promise.all([
      pgm.db.query("INSERT INTO tp(user_name) VALUES ('admin');"),
      pgm.db.query("INSERT INTO tp(user_name) VALUES ('alice');"),
      pgm.db.query("INSERT INTO tp(user_name) VALUES ('bob');")
    ])
      .then(() => pgm.db.query('set role admin;'))
      .then(() => pgm.db.select('SELECT * FROM tp;'))
      .then(
        ({ length }) =>
          length === 3 || reject(new Error('Policy is not enforced'))
      )
      .then(() => pgm.db.query('set role alice;'))
      .then(() => pgm.db.select('SELECT * FROM tp;'))
      .then(
        ({ length }) =>
          length === 1 || reject(new Error('Policy is not enforced'))
      )
      .then(() => pgm.db.query('reset role;'))
      .then(resolve)
  );

exports.down = () => null;
