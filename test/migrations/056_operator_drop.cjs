const operator = require('./054_operator_create.cjs');

exports.up = (pgm) => {
  pgm.dropOperator('+', { left: 'complex', right: 'complex' });
  pgm.dropFunction('complex_add', ['complex', 'complex']);
  pgm.dropType('complex');
};

exports.down = operator.up;
