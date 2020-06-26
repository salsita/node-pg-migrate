exports.up = (pgm) => {
  pgm.createTable('tvo', {
    id: 'id',
    string: { type: 'text', notNull: true },
    created: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  })
  pgm.createView(
    'vo',
    {
      columns: ['id', 'str'],
      options: {
        check_option: 'LOCAL',
      },
    },
    'SELECT id, string FROM tvo',
  )
  pgm.alterView('vo', {
    options: {
      check_option: 'CASCADED',
    },
  })
  pgm.alterView('vo', {
    options: {
      check_option: null,
    },
  })
}

exports.down = (pgm) => {
  pgm.dropView('vo')
  pgm.dropTable('tvo')
}
