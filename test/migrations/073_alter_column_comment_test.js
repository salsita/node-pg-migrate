const {
  table: { schema, name },
  comment,
} = require('./072_alter_column_comment')

exports.up = async (pgm) => {
  const [{ description }] = await pgm.db.select(
    `SELECT d.description
      FROM pg_description d
      join information_schema.columns c on (d.objsubid = c.ordinal_position)
      join pg_class t ON (t.relname = c.table_name and t.relkind = 'r' and d.objoid = t.oid)
      join pg_namespace n ON (t.relnamespace = n.oid and n.nspname = c.table_schema)
      WHERE c.column_name = 'id' and c.table_schema = '${schema}' and c.table_name = '${name}';`,
  )
  if (description !== comment) {
    throw new Error('Comment not set')
  }
}

exports.down = () => null
