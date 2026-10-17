export const up = (pgm) => {
  pgm.createTable(
    't_partition',
    {
      id: 'serial',
      string: { type: 'text', notNull: true },
      created: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('current_timestamp'),
      },
    },
    {
      constraints: {
        primaryKey: ['id', 'created'],
      },
      partition: {
        strategy: 'RANGE',
        columns: 'created',
      },
    }
  );
  pgm.createPartition('t_partition_all', 't_partition', {
    strategy: 'RANGE',
    from: [pgm.func('MINVALUE')],
    to: [pgm.func('MAXVALUE')],
  });
};
