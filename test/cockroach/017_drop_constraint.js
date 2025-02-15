import { constraint } from './014_add_constraint.js';

export const up = (pgm) => {
  pgm.dropConstraint('t1', constraint);
};

export const down = () => {
  // do nothing
};
