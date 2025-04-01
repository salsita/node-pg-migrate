export const comment = 'comment on column id';
const schema = 'test';
export const table = { schema: 'test', name: 'tcc' };

export const up = (pgm) => {
  pgm.createSchema(schema);
  pgm.createTable(table, {
    id: { type: 'id', comment: comment },
  });
};
