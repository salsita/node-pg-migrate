export const up = (pgm) => {
  pgm.createTable('t095', { id: { type: 'integer' } });
  pgm.createIndex('t095', 'id', { unique: true, nulls: 'not distinct' });
};

export const down = (pgm) => {
  pgm.dropTable('t095');
};
