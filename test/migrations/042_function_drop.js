import * as create from './039_function_create.js';
import * as rename from './040_function_rename.js';

export const up = (pgm) => {
  pgm.dropFunction('add', create.params);
};

export const down = (pgm) => {
  create.up(pgm);
  rename.up(pgm);
};
