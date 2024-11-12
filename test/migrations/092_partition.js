exports.up = (pgm) => {
  pgm.createTable(
    't_partition',
    {
      id: 'id',
      string: { type: 'text', notNull: true },
      created: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('current_timestamp'),
      },
    },
    {
      partition: {
        strategy: 'RANGE',
        columns: 'created',
      },
    }
  );
};
