const constraint = require('./014_add_constraint')

exports.constraint = 'chck_nmbr_new'

exports.up = (pgm) => {
  pgm.renameConstraint('t1', constraint.constraint, exports.constraint)
}
