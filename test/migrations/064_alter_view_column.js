export const up = (pgm) => {
  pgm.alterViewColumn('v', 'str', { default: 'some default value' });
};

export const down = (pgm) => {
  pgm.alterViewColumn('v', 'str', { default: null });
};
