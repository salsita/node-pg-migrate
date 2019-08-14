exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select('INSERT INTO tt (a) VALUES (1) RETURNING a')
      .then(([{ a }]) =>
        a === 2 ? resolve() : reject(new Error('Trigger does not work'))
      )
  );

exports.down = () => null;
