exports.up = (pgm) => {
  pgm.createRole('r', { password: 'p', login: true })
}
