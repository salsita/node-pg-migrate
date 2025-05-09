exports.comment = 'comment on unlogged table t_unlogged';

exports.up = (pgm) => {
  // Create an unlogged table
  pgm.createTable(
    't_unlogged',
    {
      id: 'id',
      name: { type: 'text', notNull: true },
      created_at: {
        type: 'timestamp',
        notNull: true,
        default: pgm.func('current_timestamp'),
      },
    },
    {
      unlogged: true, // Specify the table as UNLOGGED
      comment: exports.comment,
    }
  );

  // Create a regular table for comparison
  pgm.createTable(
    't_regular',
    {
      id: 'id',
      description: { type: 'text', notNull: true },
    },
    {
      comment: 'comment on regular table t_regular',
    }
  );
};
