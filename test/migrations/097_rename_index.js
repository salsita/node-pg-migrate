export const up = (pgm) => {
  pgm.createIndex("t1", ["nmbr"]);
};

export const down = () => null;
