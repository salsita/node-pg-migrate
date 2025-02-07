export const up = (pgm) => {
  pgm.addColumns(
    't1',
    {
      string: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.addColumns(
    't1',
    {
      string: { type: 'text' },
    },
    { ifNotExists: true }
  );
};

export const down = (pgm) => {
  pgm.dropColumns('t1', 'string');
};
