const column = require('./060_column_comment');

exports.up = pgm =>
  new Promise((resolve, reject) =>
    pgm.db.select(`SELECT d.description as "comment"
                FROM pg_description d join information_schema.columns c on (d.objsubid = c.ordinal_position)
                WHERE c.table_schema = 'test' and c.table_name = 'tcc';`)
      .then(([{ comment }]) => (
        comment === column.comment
          ? null
          : reject(new Error('Comment not set'))
      ))
      .then(resolve)
  );

exports.down = () => null;
