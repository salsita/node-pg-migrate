export const up = (pgm) => {
  pgm.createTable('test-comment', {}, { comment: "table's comment" });
  pgm.dropTable('test-comment');
};

export const down = () => null;
