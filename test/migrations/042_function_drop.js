const { params } = require('./039_function_create');

exports.up = (pgm) => {
  pgm.dropFunction('add', params);
};

exports.down = (pgm) => {
  pgm.createFunction('add', params, {
    returns: 'integer',
    language: 'plpgsql',
  }, `
BEGIN
  return $1 + arg2;
END;
  `);
};
