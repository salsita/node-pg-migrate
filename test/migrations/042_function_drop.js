const create = require('./039_function_create')
const rename = require('./040_function_rename')

exports.up = (pgm) => {
  pgm.dropFunction('add', create.params)
}

exports.down = (pgm) => {
  create.up(pgm)
  rename.up(pgm)
}
