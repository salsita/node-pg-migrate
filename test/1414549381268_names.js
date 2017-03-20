exports.up = function up(pgm, run) {
  pgm.createTable('names', {
    id: 'id',
    name: { type: 'varchar(10)' },
  });
  run();
};

exports.down = function down(pgm, run) {
  pgm.dropTable('names');
  run();
};
