export const up = (pgm) => {
  pgm.createIndex('t1', ['nmbr'], { name: 'idx' });
  pgm.dropIndex('t1', [], { name: 'idx' });
};

export const down = () => null;
