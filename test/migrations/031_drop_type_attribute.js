export const up = (pgm) => {
  pgm.dropTypeAttribute('obj', 'str');
};

export const down = (pgm) => {
  pgm.addTypeAttribute('obj', 'str', 'text');
};
