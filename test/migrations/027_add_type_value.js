exports.up = (pgm) => {
  pgm.noTransaction()
  pgm.addTypeValue('list', 'd', { ifNotExists: true })
}

exports.down = () => null
