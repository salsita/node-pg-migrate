export const up = (pgm) => {
  const indexName = 'idxfoose';
  const tablespaceName = 'tablespace_name';
  const tablespacePath = '/tmp/pg_test_ts';

  pgm.createIndex('t1', ['nmbr'], { name: indexName });
  pgm.sql(`CREATE TABLESPACE ${tablespaceName} LOCATION '${tablespacePath}';`);

  pgm.alterIndex(indexName, tablespaceName);
};

export const down = (pgm) => {
  const indexName = 'idxfoose';
  const tablespaceName = 'tablespace_name';

  pgm.dropIndex('t1', [], { name: indexName });
  pgm.sql(`DROP TABLESPACE ${tablespaceName};`);
};
