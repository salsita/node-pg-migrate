export const up = (pgm) => {
  const indexName = 'idxfoo';
  const tablespaceName = 'tablespace_name';
  pgm.sql(`CREATE TABLESPACE tablespace_name
[ OWNER postgres ]
LOCATION '/';`);
  pgm.createIndex('t1', ['nmbr'], { name: indexName });

  pgm.alterIndex(indexName, tablespaceName);
};

export const down = () => null;
