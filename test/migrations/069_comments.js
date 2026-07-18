export const up = (pgm) => {
  pgm.createTable(
    'test-comment',
    { id: 'serial' },
    { comment: "table's comment" }
  );
  pgm.dropTable('test-comment');
};

export const down = () => null;
