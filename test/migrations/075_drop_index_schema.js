exports.up = (pgm) => {
  const schema = 'foo'
  const tableName = { schema, name: 'bar' }
  const columnName = 'baz'

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
  pgm.createIndex(tableName, columnName)

  pgm.dropIndex(tableName, columnName)
  pgm.dropTable(tableName)
  pgm.dropSchema(schema)
}

exports.down = () => null
