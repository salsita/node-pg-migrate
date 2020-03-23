exports.up = (pgm) => {
  pgm.dropTypeAttribute('obj', 'str')
}

exports.down = (pgm) => {
  pgm.addTypeAttribute('obj', 'str', 'text')
}
