import * as trigger from './043_trigger_create_rename.js';

export const up = (pgm) => {
  pgm.dropTrigger('tt', 'trig');
  pgm.dropFunction('trig', []);
  pgm.dropTable('tt');
};

export const down = trigger.up;
