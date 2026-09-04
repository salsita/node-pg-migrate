export const up = (pgm) => {
  pgm.createTable('dry_run_table', {
    id: 'id',
    name: { type: 'text', notNull: true },
  });
};
