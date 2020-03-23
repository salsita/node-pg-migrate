exports.up = (pgm) => {
  pgm.createIndex('t1', ['nmbr'], { name: 'idx' })
}
