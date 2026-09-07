export const up = (pgm) => {
  pgm.renameTable('t2', 't2r');

  const schema = 'rename_schema';
  pgm.createSchema(schema);
  pgm.createTable({ schema, name: 'original' }, { id: 'integer' });
  pgm.renameTable({ schema, name: 'original' }, 'intermediate');
  pgm.renameTable(
    { schema, name: 'intermediate' },
    { schema, name: 'renamed' }
  );
};
