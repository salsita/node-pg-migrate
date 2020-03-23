exports.up = (pgm) => {
  pgm.setTypeAttribute('obj', 'id', 'smallint')
}

exports.down = (pgm) => {
  pgm.setTypeAttribute('obj', 'id', 'integer')
}
