exports.constraint = 'chck_id'

exports.up = (pgm) => {
  pgm.addConstraint('t1', exports.constraint, {
    check: 'id < 30',
  })
}
