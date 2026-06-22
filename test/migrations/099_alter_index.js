export const up = (pgm) => {
  const indexName = 'idxfoo';
  const tablespaceName = 'tablespace_name';
  pgm.noTransaction();
  pgm.sql(`CREATE TABLESPACE tablespace_name LOCATION '/';`);
  pgm.createIndex('t1', ['nmbr'], { name: indexName });

  pgm.alterIndex(indexName, tablespaceName);
};

export const down = (pgm) => {
  pgm.noTransaction();
  pgm.dropIndex('t1', 'idxfoo');
  pgm.sql(`DROP TABLESPACE tablespace_name;`);
};
