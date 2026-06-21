export const up = (pgm) => {
  pgm.createIndex('t1_renamed', ['nmbr']);

  pgm.renameIndex('t1_renamed', 't1_nmbr_idx', 't1_number_idx');

  pgm.dropIndex('t1_renamed', 'nmbr');
};

export const down = () => null;
