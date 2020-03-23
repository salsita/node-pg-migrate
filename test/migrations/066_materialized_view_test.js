exports.up = (pgm) => {
  pgm.sql('SELECT id, str FROM mv')
}

exports.down = () => null
