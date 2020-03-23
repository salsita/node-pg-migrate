const create = require('./035_role_add')
const rename = require('./037_role_rename')

exports.up = (pgm) => {
  pgm.dropRole('rx')
}

exports.down = (pgm) => {
  create.up(pgm)
  rename.up(pgm)
}
