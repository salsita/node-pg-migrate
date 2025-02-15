export const up = (pgm, run) => {
  pgm.createTable('names', {
    id: 'id',
    name: { type: 'varchar(10)' },
  });
  run();
};

export const down = (pgm, run) => {
  pgm.dropTable('names');
  run();
};
