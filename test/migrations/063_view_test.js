export const up = (pgm) => {
  pgm.sql('SELECT id, str FROM v');
};

export const down = () => null;
