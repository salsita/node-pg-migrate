# Miscellaneous Operations

### `pgm.sql( sql )`

> Run raw sql -- with some optional _[very basic](http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/)_ mustache templating

**Arguments:**

- `sql` _[string]_ - SQL query to run
- `args` _[object]_ - (optional) key/val of arguments to replace

---

### `pgm.func( sql )`

> Inserts raw string, which is not escaped

e.g. `pgm.func('CURRENT_TIMESTAMP')` to use in `default` option for column definition

**Arguments:**

- `sql` _[string]_ - string to not be escaped

---

### `pgm.db.query` and `pgm.db.select`

> Allows to run DB queries with same DB connection migration is running
> See [pg.Client.query](https://node-postgres.com/api/client#client-query)

Returns promise with either result of query or returned rows of query (in case of `select`).

---

### `pgm.noTransaction`

By default, all migrations are run in one transaction, but some DB operations like add type value (`pgm.addTypeValue`)
does not work if the type is not created in the same transaction. E.g. if it is created in previous migration. You need to
run specific migration outside a transaction (`pgm.noTransaction`). Be aware that this means that you can have
some migrations applied and some not applied, if there is some error during migrating (leading to `ROLLBACK`)
