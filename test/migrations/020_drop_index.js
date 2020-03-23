exports.up = (pgm) => {
  pgm.createIndex('t1', ['nmbr'], { name: 'idx' })
  pgm.dropIndex('t1', [], { name: 'idx' })
}

exports.down = () => null
