export const up = (pgm) => {
  pgm.createIndex('t1', ['nmbr'], { unique: true });
};
