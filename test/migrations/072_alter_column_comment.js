exports.comment = 'This is my comment'
const schema = 'comment_schema'
exports.table = { schema, name: 't' }

exports.up = (pgm) => {
  pgm.createSchema(schema)
  pgm.createTable(exports.table, { id: 'id' })
  pgm.alterColumn(exports.table, 'id', { type: 'text' })
  pgm.alterColumn(exports.table, 'id', { comment: exports.comment })
}

exports.down = (pgm) => {
  pgm.dropTable(exports.table)
  pgm.dropSchema(schema)
}
