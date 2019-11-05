exports.up = pgm =>
  pgm.db
    .select('INSERT INTO ts DEFAULT VALUES RETURNING id;')
    .then(([{ id }]) => {
      if (id !== 10) throw new Error('Bad sequence value');
    });

exports.down = () => null;
