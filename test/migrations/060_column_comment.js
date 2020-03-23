exports.comment = 'comment on column id'
const schema = 'test'
exports.table = { schema: 'test', name: 'tcc' }

exports.up = (pgm) => {
  pgm.createSchema(schema)
  pgm.createTable(exports.table, {
    id: { type: 'id', comment: exports.comment },
  })
}
