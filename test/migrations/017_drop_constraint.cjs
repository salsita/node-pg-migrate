const constraint = require('./016_rename_constraint.cjs');

exports.up = (pgm) => {
  pgm.dropConstraint('t1', constraint.constraint);
};

exports.down = (pgm) => {
  pgm.addConstraint('t1', constraint.constraint, {
    check: 'true',
  });
};
