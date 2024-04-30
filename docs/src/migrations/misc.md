# Miscellaneous Operations

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
