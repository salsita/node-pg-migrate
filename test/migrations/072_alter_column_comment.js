export const comment = 'This is my comment';
const schema = 'comment_schema';
export const table = { schema, name: 't' };

export const up = (pgm) => {
  pgm.createSchema(schema);
  pgm.createTable(table, { id: 'id' });
  pgm.alterColumn(table, 'id', { type: 'text' });
  pgm.alterColumn(table, 'id', { comment: comment });
};

export const down = (pgm) => {
  pgm.dropTable(table);
  pgm.dropSchema(schema);
};
