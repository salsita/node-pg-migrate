exports.up = (pgm) => {
  pgm.renameRole('r', 'rx')
}
