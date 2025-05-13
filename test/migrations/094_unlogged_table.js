export const comment = 'comment on unlogged table t_unlogged';

export const up = async (pgm) => {
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

  // Alter the regular table to set it as LOGGED
  pgm.alterTable('t_regular', {
    setOptions: { logged: true },
  });

  // Add assertions to validate the migration
  const { rows: unloggedTable } = await pgm.db.query(`
    SELECT relpersistence
    FROM pg_class
    WHERE relname = 't_unlogged';
  `);
  if (unloggedTable[0].relpersistence !== 'u') {
    throw new Error('t_unlogged is not UNLOGGED');
  }

  const { rows: loggedTable } = await pgm.db.query(`
    SELECT relpersistence
    FROM pg_class
    WHERE relname = 't_regular';
  `);
  if (loggedTable[0].relpersistence !== 'p') {
    throw new Error('t_regular is not LOGGED');
  }
};

export const down = (pgm) => {
  pgm.dropTable('t_unlogged');
  pgm.dropTable('t_regular');
};
