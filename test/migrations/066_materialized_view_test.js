export const up = (pgm) => {
  pgm.sql('SELECT id, str FROM mv');
};

export const down = () => null;
