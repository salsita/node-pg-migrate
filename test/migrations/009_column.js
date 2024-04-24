exports.up = (pgm) => {
  pgm.addColumns('t1', {
    nr: { type: 'integer', unique: true, check: 'nr > 10' },
  });
};
