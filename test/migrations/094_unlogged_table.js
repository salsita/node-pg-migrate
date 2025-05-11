export const comment = 'comment on unlogged table t_unlogged';

export const up = (pgm) => {
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
      comment,
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

  // Create table with temporary = true to ensure order is correct

  pgm.createTable(
    't_temp_unlogged',
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
      unlogged: true,
      temporary: true
    }
  );
};
