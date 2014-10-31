exports.up = function(pgm, run) {

  pgm.createTable( 'names', {
    id: 'id',
    name: { type: 'varchar(10)' }
    });
  run();
};

exports.down = function(pgm, run) {

  pgm.dropTable( 'names' );
  run();
};
