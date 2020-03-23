exports.up = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    type: 'smallint',
  })
}

exports.down = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    type: 'integer',
  })
}
