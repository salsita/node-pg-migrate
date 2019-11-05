exports.up = pgm =>
  pgm.db
    .select('INSERT INTO tt (a) VALUES (1) RETURNING a;')
    .then(([{ a }]) => {
      if (a !== 2) throw new Error('Trigger does not work');
    });

exports.down = () => null;
