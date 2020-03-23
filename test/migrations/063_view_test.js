exports.up = (pgm) => {
  pgm.sql('SELECT id, str FROM v')
}

exports.down = () => null
