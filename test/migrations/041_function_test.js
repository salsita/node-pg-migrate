exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select('SELECT add(1,2) as r')
      .then(([{ r }]) =>
        r === 3 ? resolve() : reject(new Error('Function does not work'))
      )
  );

exports.down = () => null;
