exports.constraint = 'chck_nmbr';

exports.up = (pgm) => {
  pgm.addConstraint('t1', exports.constraint, {
    check: 'nmbr < 30',
    comment: 'nmbr must be less than 30',
  });
};
