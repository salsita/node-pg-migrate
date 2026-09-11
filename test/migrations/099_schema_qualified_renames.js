export const up = (pgm) => {
  const schema = 'object_rename_schema';
  const name = (name) => ({ schema, name });
  pgm.createSchema(schema);

  pgm.createType(name('old_type'), ['active']);
  pgm.renameType(name('old_type'), 'middle_type');
  pgm.renameType(name('middle_type'), name('new_type'));

  pgm.createDomain(name('old_domain'), 'integer', { check: 'VALUE >= 0' });
  pgm.renameDomain(name('old_domain'), 'middle_domain');
  pgm.renameDomain(name('middle_domain'), name('new_domain'));

  pgm.createView(name('old_view'), {}, 'SELECT 1 AS value');
  pgm.renameView(name('old_view'), 'middle_view');
  pgm.renameView(name('middle_view'), name('new_view'));

  pgm.createMaterializedView(
    name('old_materialized_view'),
    {},
    'SELECT 1 AS value'
  );
  pgm.renameMaterializedView(
    name('old_materialized_view'),
    'middle_materialized_view'
  );
  pgm.renameMaterializedView(
    name('middle_materialized_view'),
    name('new_materialized_view')
  );

  pgm.createSequence(name('old_sequence'), { start: 10 });
  pgm.renameSequence(name('old_sequence'), 'middle_sequence');
  pgm.renameSequence(name('middle_sequence'), name('new_sequence'));

  pgm.createTable(name('indexed_table'), { value: 'integer' });
  pgm.createIndex(name('indexed_table'), 'value', { name: 'old_index' });
  pgm.renameIndex(name('old_index'), 'middle_index');
  pgm.renameIndex(name('middle_index'), name('new_index'));
};
