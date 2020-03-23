exports.up = (pgm) => {
  pgm.createTable('tv', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createView(
    'v',
    {
      columns: ['id', 'str'],
    },
    'SELECT id, string FROM tv',
  )
}
