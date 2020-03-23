exports.up = (pgm) => {
  const schema = 'a.b::c'
  const tableName = { schema, name: 'bar' }
  const columnName = 'baz'
  const indexName = 'idx'

  pgm.createSchema(schema)
  pgm.createTable(tableName, {
    foo_id: {
      type: 'serial',
      primaryKey: true,
    },
    [columnName]: {
      type: 'integer',
      notNull: true,
    },
  })
  pgm.createIndex(tableName, columnName, { name: indexName })

  pgm.dropIndex(tableName, columnName, { name: indexName })
  pgm.dropTable(tableName)
  pgm.dropSchema(schema)
}

exports.down = () => null
