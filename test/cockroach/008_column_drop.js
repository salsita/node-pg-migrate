exports.up = (pgm) => {
  pgm.dropColumns('t1', 'string')
}

exports.down = (pgm) => {
  pgm.addColumns('t1', {
    string: { type: 'text', notNull: false },
  })
}
