export const up = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    default: 10,
  });
};

export const down = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    default: null,
  });
};
