export const up = (pgm) => {
  pgm.renameTypeAttribute('obj', 'string', 'str');
};
