exports.up = (pgm) => {
  pgm.renameTable('t2', 't2r')
}
