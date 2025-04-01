export const up = (pgm) => {
  pgm.alterSequence('seq', { restart: 20 });
};

export const down = () => null;
