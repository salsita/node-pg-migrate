const sequence = require('./049_sequence_create_rename')

exports.up = (pgm) => {
  pgm.dropTable('ts')
  pgm.dropSequence('seq')
}

exports.down = sequence.up
