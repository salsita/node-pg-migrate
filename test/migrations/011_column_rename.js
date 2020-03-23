exports.up = (pgm) => {
  pgm.renameColumn('t1', 'nr', 'nmbr')
}
