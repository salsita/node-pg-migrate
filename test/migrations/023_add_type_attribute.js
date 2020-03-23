exports.up = (pgm) => {
  pgm.addTypeAttribute('obj', 'string', 'text')
}
