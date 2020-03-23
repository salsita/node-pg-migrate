exports.up = (pgm) => {
  pgm.renameTypeAttribute('obj', 'string', 'str')
}
