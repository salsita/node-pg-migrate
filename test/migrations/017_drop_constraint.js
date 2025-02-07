import { constraint } from './016_rename_constraint.js';

export const up = (pgm) => {
  pgm.dropConstraint('t1', constraint);
};

export const down = (pgm) => {
  pgm.addConstraint('t1', constraint, {
    check: 'true',
  });
};
