export const constraint = 'chck_id';

export const up = (pgm) => {
  pgm.addConstraint('t1', constraint, {
    check: 'id < 30',
  });
};

export const down = () => {
  // do nothing
};
