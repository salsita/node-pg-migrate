exports.up = (pgm) => {
  pgm.createTable('t1', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createTable(
    't2',
    {
      id1: 'id',
      id2: { type: 'integer', primaryKey: true },
    },
    {
      ifNotExists: true,
    }
  );
};
