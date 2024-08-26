const domain = require('./046_domain_create_rename.cjs');

exports.up = (pgm) => {
  pgm.dropTable('td');
  pgm.dropDomain('dom');
};

exports.down = domain.up;
