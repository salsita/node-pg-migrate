import fs from 'fs';

const tablespacePath = '/tmp/pg_test_ts';

export const up = (pgm) => {
  const indexName = 'idxfoo';
  const tablespaceName = 'tablespace_name';

  if (!fs.existsSync(tablespacePath)) {
    fs.mkdirSync(tablespacePath, { recursive: true });
    fs.chmodSync(tablespacePath, 0o777);
  }

  pgm.noTransaction();
  pgm.sql(`CREATE TABLESPACE ${tablespaceName} LOCATION '${tablespacePath}';`);
  pgm.createIndex('t1', ['nmbr'], { name: indexName });

  pgm.alterIndex(indexName, tablespaceName);
};

export const down = (pgm) => {
  pgm.noTransaction();
  pgm.dropIndex('t1', 'idxfoo');
  pgm.sql(`DROP TABLESPACE tablespace_name;`);
};
