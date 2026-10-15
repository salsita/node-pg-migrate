# Miscellaneous Operations

## Operation `pgm.insert`

#### `pgm.insert( tableName, values )`

Queues an `INSERT` for one row. Table and column names are quoted as identifiers;
values are escaped as SQL values. Strings are data, including quotes, dollar signs,
and braces. Use `pgm.func(...)` only for intentional SQL expressions.

### Arguments

| Name        | Type                                 | Description                                                                      |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `tableName` | `Name`                               | Table name, optionally schema-qualified                                          |
| `values`    | `Record<string, Value \| undefined>` | Column names mapped to strings, numbers, booleans, null, arrays, or SQL literals |

Omitted columns and fields with `undefined` values use their database defaults.
An empty object or a row containing only `undefined` inserts `DEFAULT VALUES`.
Identifier names follow the `decamelize` option; values do not.

Unsupported values (including plain objects, `Date`, `bigint`, and `Buffer`) and
non-finite numbers (`NaN`, `Infinity`, and `-Infinity`) throw a `TypeError` naming
the table and column before the insert is queued. Array elements are validated
recursively; `undefined` elements are rejected rather than omitted.

For JSON/JSONB columns, pass `JSON.stringify(data)` as the value. PostgreSQL
converts the escaped string to the column's type. Convert dates to strings when
appropriate, or use `pgm.func(...)` / `PgLiteral` for explicit SQL expressions.
An empty JavaScript array renders as `ARRAY[]`, which needs an explicit element
type; use `pgm.func("'{}'::text[]")` for an empty text array, or omit the column
when its default is appropriate.

Each call inserts one row and produces one queued statement, database round trip,
and logged SQL statement. The loop below is suitable for small lookup tables;
large imports should use a multi-row `INSERT` or `COPY` through the existing SQL
or client interfaces, respecting the execution order described below.

```js
export function up(pgm) {
  pgm.createTable('media_types', {
    id: 'id',
    name: { type: 'text', notNull: true },
  });

  for (const name of ['paper', 'ebook', "reader's edition"]) {
    pgm.insert('media_types', { name });
  }
}

export function down(pgm) {
  pgm.dropTable('media_types');
}
```

Like other queued operations, inserts execute after the migration function
finishes, in the order they were queued. They can depend on a preceding
`pgm.createTable` and participate in the migration's transaction and dry run.
The operation returns no query result and requires an explicit `down` migration:
the library cannot infer which rows should be removed.

## Operation `pgm.sql`

#### `pgm.sql( sql )`

> [!IMPORTANT]
> Run raw sql—with some optional
> _[very basic](http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/)_ mustache templating

### Arguments

| Name   | Type     | Description                                                              |
| ------ | -------- | ------------------------------------------------------------------------ |
| `sql`  | `string` | SQL query to run                                                         |
| `args` | `object` | (optional) key/val of arguments to replace in the SQL query (templating) |

`args` uses `{key}` placeholders, not PostgreSQL `$1` parameters. String arguments
are quoted as identifiers. To insert string data, use [pgm.insert](#operation-pgm-insert).
Without `args`, the SQL is queued without template substitutions.

## Operation `pgm.func`

#### `pgm.func( sql )`

> [!IMPORTANT]
> Inserts raw string, which is not escaped
> e.g. `pgm.func('CURRENT_TIMESTAMP')` to use in `default` option for column definition

### Arguments

| Name  | Type     | Description              |
| ----- | -------- | ------------------------ |
| `sql` | `string` | String to not be escaped |

## Operation `pgm.db`

#### `pgm.db.query` and `pgm.db.select`

> [!IMPORTANT]
> Allows running DB queries with the same DB connection migration is running
> See [pg.Client.query](https://node-postgres.com/api/client#client-query)

Returns promise with either result of query or returned rows of a query (in case of `select`).

## Operation `pgm.noTransaction`

#### `pgm.noTransaction`

By default, all migrations are run in one transaction, but some DB operations like add type value (`pgm.addTypeValue`)
does not work if the type is not created in the same transaction.
E.g., if it is created in previous migration.
You need to run specific migration outside a transaction (`pgm.noTransaction`).
Be aware that this means that you can have
some migrations applied and some not applied, if there is some error during migrating (leading to `ROLLBACK`)
