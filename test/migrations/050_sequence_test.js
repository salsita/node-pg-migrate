exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select('INSERT INTO ts DEFAULT VALUES RETURNING id;')
      .then(([{ id }]) =>
        id === 10 ? resolve() : reject(new Error('Bad sequence value'))
      )
  );

exports.down = () => null;
