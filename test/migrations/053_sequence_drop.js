import * as sequence from './049_sequence_create_rename.js';

export const up = (pgm) => {
  pgm.dropTable('ts');
  pgm.dropSequence('seq');
};

export const down = sequence.up;
