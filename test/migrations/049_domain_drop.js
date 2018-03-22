exports.up = (pgm) => {
  pgm.dropTable('td');
  pgm.dropDomain('dom');
};

exports.down = (pgm) => {
  pgm.createDomain('dom', 'integer', {
    check: 'VALUE BETWEEN 0 AND 10',
  });
  pgm.createTable('td', {
    d: 'dom',
  });
};
