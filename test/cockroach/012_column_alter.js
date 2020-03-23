exports.up = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    default: 10,
  })
}

exports.down = (pgm) => {
  pgm.alterColumn('t1', 'nmbr', {
    default: null,
  })
}
