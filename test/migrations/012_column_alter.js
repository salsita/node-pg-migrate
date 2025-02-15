export const up = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    type: 'smallint',
  });
};

export const down = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    type: 'integer',
  });
};
