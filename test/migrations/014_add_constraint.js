exports.constraint = 'chck_nmbr'

exports.up = (pgm) => {
  pgm.addConstraint('t1', exports.constraint, {
    check: 'nmbr < 30',
  })
}
