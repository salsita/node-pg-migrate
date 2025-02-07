export const up = (pgm) => {
  pgm.createTable('t_uniq_index', {
    id: 'serial',
    name: 'text',
  });
  pgm.createIndex('t_uniq_index', ['name'], { unique: true });
};

export const down = (pgm) => {
  pgm.dropIndex('t_uniq_index', ['name'], { unique: true });
  pgm.dropTable('t_uniq_index');
};
