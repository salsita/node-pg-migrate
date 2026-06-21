export const up = (pgm) => {
  const schema = 'foobar';
  const tableName = { schema, name: 'barfoo' };
  const columnName = 'bazfoo';

  pgm.createSchema(schema);
  pgm.createTable(tableName, {
    foo_id: {
      type: 'serial',
      primaryKey: true,
    },
    [columnName]: {
      type: 'integer',
      notNull: true,
    },
  });
  pgm.createIndex(tableName, columnName);

  const oldIndexName = pgm.getIndexName(tableName, columnName);
  const newIndexName = 'quxfoo';
  pgm.renameIndex(oldIndexName, newIndexName);
  pgm.dropIndex(tableName, newIndexName);
};

export const down = () => null;
