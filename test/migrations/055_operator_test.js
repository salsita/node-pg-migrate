exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select('SELECT ROW(1,2)::complex + ROW(3,4)::complex as sum;')
      .then(([{ sum }]) =>
        sum === '(4,6)' ? resolve() : reject(new Error('Bad sequence value'))
      )
  );

exports.down = () => null;
