exports.up = (pgm) => {
  pgm.createTable('tmv', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createMaterializedView(
    'mvx',
    {
      columns: ['id', 'strx'],
      storageParameters: {
        autovacuum_enabled: true,
        autovacuum_vacuum_threshold: 50,
      },
    },
    'SELECT id, string FROM tmv',
  )
  pgm.renameMaterializedView('mvx', 'mv')
  pgm.renameMaterializedViewColumn('mv', 'strx', 'str')
  pgm.refreshMaterializedView('mv')
}
