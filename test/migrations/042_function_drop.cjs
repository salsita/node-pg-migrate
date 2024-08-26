const create = require('./039_function_create.cjs');
const rename = require('./040_function_rename.cjs');

exports.up = (pgm) => {
  pgm.dropFunction('add', create.params);
};

exports.down = (pgm) => {
  create.up(pgm);
  rename.up(pgm);
};
