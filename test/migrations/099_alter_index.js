export const up = (pgm) => {
  const indexName = 'idxfoo';
  const tablespaceName = 'tablespace_name';
  pgm.createIndex('t1', ['nmbr'], { name: indexName });

  pgm.alterIndex(indexName, tablespaceName);
};

export const down = () => null;
