import * as domain from './046_domain_create_rename.js';

export const up = (pgm) => {
  pgm.dropTable('td');
  pgm.dropDomain('dom');
};

export const down = domain.up;
