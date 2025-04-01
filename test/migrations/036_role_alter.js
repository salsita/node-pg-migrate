export const up = (pgm) => {
  pgm.alterRole('r', { login: false });
};

export const down = (pgm) => {
  pgm.alterRole('r', { login: true });
};
