export const up = (pgm) => {
  pgm.createTable('t095', { id: { type: 'integer', notNull: true } });
  pgm.createIndex('t095', 'id', { nulls: 'distinct' });
};

export const down = (pgm) => {
  pgm.dropTable('t095');
};
