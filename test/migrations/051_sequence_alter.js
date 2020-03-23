exports.up = (pgm) => {
  pgm.alterSequence('seq', { restart: 20 })
}

exports.down = () => null
