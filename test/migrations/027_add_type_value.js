export const up = (pgm) => {
  pgm.noTransaction();
  pgm.addTypeValue('list', 'd', { ifNotExists: true });
};

export const down = () => null;
