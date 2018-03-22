exports.up = (pgm) => {
  pgm.createDomain('d', 'integer', {
    check: 'VALUE BETWEEN 0 AND 10',
  });
  pgm.createTable('td', {
    d: 'd',
  });
};
