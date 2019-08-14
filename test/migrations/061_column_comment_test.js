const {
  comment,
  table: { schema, name }
} = require('./060_column_comment');

exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db
      .select(
        `SELECT d.description
            FROM pg_description d
            join information_schema.columns c on (d.objsubid = c.ordinal_position)
            join pg_class t ON (t.relname = c.table_name and t.relkind = 'r' and d.objoid = t.oid)
            join pg_namespace n ON (t.relnamespace = n.oid and n.nspname = c.table_schema)
            WHERE c.column_name = 'id' and c.table_schema = '${schema}' and c.table_name = '${name}';`
      )
      .then(([{ description }]) =>
        description === comment ? null : reject(new Error('Comment not set'))
      )
      .then(resolve)
  );

exports.down = () => null;
