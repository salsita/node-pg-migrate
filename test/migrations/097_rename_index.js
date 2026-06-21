export const up = (pgm) => {
  const currentIndexName = 'idxfoo';
  const newIndexName = 'quxfoo';
  pgm.createIndex('t1', ['nmbr'], { name: currentIndexName });

  pgm.renameIndex(currentIndexName, newIndexName);
  pgm.dropIndex('t1', [], { name: newIndexName });
};

export const down = () => null;
