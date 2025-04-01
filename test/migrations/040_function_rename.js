import { params } from './039_function_create.js';

export const up = (pgm) => {
  pgm.renameFunction('f', params, 'add');
};
