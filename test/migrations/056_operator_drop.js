import * as operator from './054_operator_create.js';

export const up = (pgm) => {
  pgm.dropOperator('+', { left: 'complex', right: 'complex' });
  pgm.dropFunction('complex_add', ['complex', 'complex']);
  pgm.dropType('complex');
};

export const down = operator.up;
