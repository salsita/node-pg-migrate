---
next:
  text: 'Tables'
  link: '/migrations/tables'
---

# Defining Migrations

## Running Migrations

When you run `node-pg-migrate create` a new migration file is created that looks like this:

```javascript
export const shorthands = undefined;

export const up = function up(pgm) {};

export const down = function down(pgm) {};
```

`pgm` is a helper object that provides migration operations and `run` is the callback to call when you are done.

`shorthands` is optional for column type shorthands. You can specify custom types which will be expanded to column
definition.

### Example

```js
export const shorthands = {
  id: { type: 'uuid', primaryKey: true },
  createdAt: {
    type: 'timestamp',
    notNull: true,
    default: new PgLiteral('current_timestamp'),
  },
};
```

It will in `pgm.createTable('test', { id: 'id', createdAt: 'createdAt' });` produce SQL

```sql
CREATE TABLE "test" ("id" uuid PRIMARY KEY, "createdAt" timestamp DEFAULT current_timestamp NOT NULL);
```

These shorthands are inherited from previous migrations. You can override/change value by simply defining a new value
for a given shorthand name
if it is used in current and all following migrations (until changed again).

> [!IMPORTANT]
> Calling the migration functions on `pgm` doesn't migrate your database. These functions just add sql commands to a
> stack that is run.

## Automatic Down Migrations

If `export const down` is not present in a migration, node-pg-migrate will try to automatically infer the operations that
make up the down migration by reversing the operations of the up migration. Only some operations have automatically
inferrable equivalents (the details below on each operation). Sometimes, migrations are destructive and cannot be rolled
back. In this case, you can set `export const down = false` to tell node-pg-migrate that the down migration is impossible.

## Async Migrations

In some cases, you may want to perform some async operation during a migration, for example, fetching some information
from an external server, or inserting some data into the database. To make a migration block operate in async mode, add
another callback argument to the function signature. However, be aware that NONE of the pgm operations will be executed
until `run()` is called. Here's an example:

```javascript
export const up = function up(pgm, run) {
  doSomethingAsync(function () {
    run();
  });
};
```

Another way how to perform some async operation is to return [Promise](https://promisesaplus.com/) from `up` or `down`
function. Example:

```javascript
export const up = function (pgm) {
  return new Promise((resolve) => {
    // doSomethingAsync
    resolve();
  });
};
```

or

```javascript
export const up = async (pgm) => {
  // doSomethingAsync
};
```

## Using schemas

Instead of passing string as name to `pgm` functions, you can pass an object with keys `schema` and `name`. E.g.

```javascript
pgm.createTable(
  { schema: 'my_schema', name: 'my_table_name' },
  { id: 'serial' }
);
```

will generate

```sql
CREATE TABLE "my_schema"."my_table_name" (
 "id" serial
);
```

### Type

```ts
type Name = string | { schema: string; name: string };
```

## Locking

`node-pg-migrate` automatically checks if no other migration is running. To do so, it uses an
[advisory lock](https://www.postgresql.org/docs/current/static/explicit-locking.html#id-1.5.12.6.9.2)
(see [#239](https://github.com/salsita/node-pg-migrate/pull/239)).
Lock is held for the duration of DB session, so if migration scripts froze up, you need to kill it,
before running another migration script.

## Migration methods

The `pgm` object that is passed to each up/down block has many different operations available.
Each operation is simply
a function that generates some sql and stores it in the current pgm context.

By default, all migrations will be run in a transaction.
To disable transactions for a specific migration,
call `pgm.noTransaction()`
This is required for some SQL operations that cannot be run within a transaction.
It should be used carefully.

- [Tables](tables.md)
- [Columns](columns.md)
- [Constraints](constraints.md)
- [Indexes](indexes.md)
- [Functions](functions.md)
- [Triggers](triggers.md)
- [Schemas](schemas.md)
- [Sequences](sequences.md)
- [Views](views.md)
- [Materialized Views](mViews.md)
- [Types](types.md)
- [Domains](domains.md)
- [Operators](operators.md)
- [Roles](roles.md)
- [Policies](policies.md)
- [Extensions](extensions.md)
- [Miscellaneous](misc.md)
