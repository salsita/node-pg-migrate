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
      options: {
        check_option: 'LOCAL',
      },
    },
    'SELECT id, string FROM tv',
  )
  pgm.alterView('v', {
    options: {
      check_option: 'CASCADED',
    },
  })
  pgm.alterView('v', {
    options: {
      check_option: null,
    },
  })
}
