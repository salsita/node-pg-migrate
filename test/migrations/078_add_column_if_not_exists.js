exports.up = (pgm) => {
  pgm.addColumns(
    't1',
    {
      string: { type: 'text' },
    },
    { ifNotExists: true },
  )

  pgm.addColumns(
    't1',
    {
      string: { type: 'text' },
    },
    { ifNotExists: true },
  )
}

exports.down = (pgm) => {
  pgm.dropColumns('t1', 'string')
}
