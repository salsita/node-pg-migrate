exports.up = (pgm) => {
  pgm.alterViewColumn('v', 'str', { default: 'some default value' })
}

exports.down = (pgm) => {
  pgm.alterViewColumn('v', 'str', { default: null })
}
