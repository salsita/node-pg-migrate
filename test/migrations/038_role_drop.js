import * as create from './035_role_add.js';
import * as rename from './037_role_rename.js';

export const up = (pgm) => {
  pgm.dropRole('rx');
};

export const down = (pgm) => {
  create.up(pgm);
  rename.up(pgm);
};
