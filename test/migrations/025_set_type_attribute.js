export const up = (pgm) => {
  pgm.setTypeAttribute('obj', 'id', 'smallint');
};

export const down = (pgm) => {
  pgm.setTypeAttribute('obj', 'id', 'integer');
};
