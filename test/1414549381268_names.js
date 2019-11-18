exports.up = (pgm, run) => {
  pgm.createTable('names', {
    id: 'id',
    name: { type: 'varchar(10)' },
  })
  run()
}

exports.down = (pgm, run) => {
  pgm.dropTable('names')
  run()
}
