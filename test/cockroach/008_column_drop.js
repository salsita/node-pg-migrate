export const up = (pgm) => {
  pgm.dropColumns('t1', 'string');
};

export const down = (pgm) => {
  pgm.addColumns('t1', {
    string: { type: 'text', notNull: false },
  });
};
