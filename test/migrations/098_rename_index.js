export const up = (pgm) => {
  const currentIndexName = 'idxfoo';
  const newIndexName = 'quxfoo';
  pgm.createIndex('t1', ['nmbr'], { name: currentIndexName });

  pgm.renameIndex(currentIndexName, newIndexName);
};

export const down = (pgm) => {
  const currentIndexName = 'idxfoo';
  const newIndexName = 'quxfoo';
  pgm.renameIndex(newIndexName, currentIndexName);
};
