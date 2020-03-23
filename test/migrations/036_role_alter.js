exports.up = (pgm) => {
  pgm.alterRole('r', { login: false })
}

exports.down = (pgm) => {
  pgm.alterRole('r', { login: true })
}
