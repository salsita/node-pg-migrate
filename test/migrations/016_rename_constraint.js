import { constraint as constraint_014 } from './014_add_constraint.js';

export const constraint = 'chck_nmbr_new';

export const up = (pgm) => {
  pgm.renameConstraint('t1', constraint_014, constraint);
};
