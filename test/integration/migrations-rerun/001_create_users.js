exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    name: 'varchar(255)',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
