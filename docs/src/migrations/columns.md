# Column Operations

## Column Definitions

The `createTable` and `addColumns` methods both take a `columns` argument that specifies column names and options.
It is an object (key/value) where each key is the name of the column,
and the value is another object that defines the options for the column.

| Option                        | Type                           | Description                                                                                       |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `type`                        | `string`                       | Data type (use normal postgres types)                                                             |
| `array`                       | `boolean` or `number`          | Defines the column as a PostgreSQL array type. Use `true` for `ARRAY` or a number for `ARRAY[n]`. |
| `collation`                   | `string`                       | Collation of data type                                                                            |
| `unique`                      | `boolean`                      | Set to true to add a unique constraint on this column                                             |
| `primaryKey`                  | `boolean`                      | Set to true to make this column the primary key                                                   |
| `notNull`                     | `boolean`                      | Set to true to make this column not null                                                          |
| `default`                     | [Value](#default-values)       | Adds DEFAULT clause for column. See [Default values](#default-values)                             |
| `check`                       | `string` or `function`         | SQL for a check constraint, or a callback receiving the quoted column identifier                  |
| `references`                  | [Reference](/migrations/#type) | Target table, optionally with explicit column names                                               |
| `referencesConstraintName`    | `string`                       | Name of the created constraint                                                                    |
| `referencesConstraintComment` | `string`                       | Comment on the created constraint                                                                 |
| `onDelete`                    | `string`                       | Adds ON DELETE constraint for a reference column                                                  |
| `onUpdate`                    | `string`                       | Adds ON UPDATE constraint for a reference column                                                  |
| `match`                       | `string`                       | `FULL` or `SIMPLE`                                                                                |
| `deferrable`                  | `boolean`                      | Flag for deferrable column constraint                                                             |
| `deferred`                    | `boolean`                      | Flag for initially deferred deferrable column constraint                                          |
| `comment`                     | `string`                       | Adds comment on column                                                                            |
| `expressionGenerated`         | `string`                       | Expression to compute column value                                                                |
| `sequenceGenerated`           | `object`                       | Creates identity column see [sequence options section](sequences.md#sequence-options)             |
| `precedence`                  | `string`                       | `ALWAYS` or `BY DEFAULT`                                                                          |

### Default values

The `default` option of column definitions, [`alterColumn`](#operation-altercolumn),
[`createDomain`](domains.md#operation-createdomain) and
[`alterDomain`](domains.md#operation-alterdomain) accepts:

| Value                                      | Example                                         | Rendered SQL                             |
| ------------------------------------------ | ----------------------------------------------- | ---------------------------------------- |
| number                                     | `default: 0`                                    | `DEFAULT 0`                              |
| boolean                                    | `default: false`                                | `DEFAULT false`                          |
| string                                     | `default: 'draft'`                              | `DEFAULT $pga$draft$pga$`                |
| array                                      | `default: ['a', 'b']` (on `text[]`)             | `DEFAULT ARRAY[$pga$a$pga$,$pga$b$pga$]` |
| [`pgm.func()`](misc.md#operation-pgm-func) | `default: pgm.func('now()')` (on `timestamptz`) | `DEFAULT now()`                          |
| `null`                                     | `default: null`                                 | see below                                |

A string is always escaped as a string literal, so `default: 'now()'` stores the text `now()`.
Use `pgm.func()` for SQL expressions and function calls.

`null` and an omitted `default` behave differently depending on the operation:

- `createTable`, `addColumns` and `createDomain`: `default: null` adds `DEFAULT NULL`.
  Omitting `default` adds no DEFAULT clause.
- `alterColumn` and `alterDomain`: `default: null` removes the existing default with `DROP DEFAULT`.
  Omitting `default` leaves the existing default unchanged.

Plain objects are not supported as defaults (see [#744](https://github.com/salsita/node-pg-migrate/issues/744)).
For a `json` or `jsonb` default, pass a string such as `default: '{}'`.

To reference a unique column other than the primary key, specify its name:

```javascript
pgm.addColumns('orders', {
  customer_code: {
    type: 'text',
    references: { schema: 'app', name: 'customers', columns: 'code' },
  },
});
```

A column-level foreign key must target a single column. Specify an explicit
target with a string or a one-element array in `references.columns`. For
composite foreign keys, use the [constraint definition](constraints.md#foreign-keys).

### Reusable check constraints

Use a `check` callback when a [type shorthand](index.md#example) needs to refer
to the column it is applied to:

```javascript
export const shorthands = {
  price: { type: 'numeric', check: (column) => `${column} > 0` },
};

export const up = (pgm) => {
  pgm.createTable('products', { retail_price: 'price' });
  pgm.addColumns('products', { wholesale_price: 'price' });
};
```

This generates `CHECK ("retail_price" > 0)` and `CHECK ("wholesale_price" > 0)`.
The callback receives the column identifier already quoted and, when enabled,
decamelized. Interpolate it directly without adding quotes. Return a synchronous
SQL expression without the `CHECK` wrapper; the returned SQL is used as written.
Empty or whitespace-only strings and non-string results (including promises)
throw a `TypeError` before SQL is queued.
Callbacks also work in ordinary column definitions. A column's explicit `check`
overrides the shorthand's check. Existing string checks remain literal SQL.

## Data types & Convenience Shorthand

Data type strings will be passed through directly to postgres, so write types as you would if you were writing the
queries by hand.

**PostgreSQL array columns can be defined with the `array` option:**

```ts
pgm.addColumns('myTable', {
  tags: { type: PgType.TEXT, array: true },
  payByQuarter: { type: PgType.INTEGER, array: 4 },
});
```

String-based PostgreSQL array type declarations continue to work as before:

```ts
pgm.addColumns('myTable', { tags: { type: 'text[]' } });
```

**There are some aliases on types to make things more foolproof:** _(int, string, float, double, datetime, bool)_

**There is a shorthand to pass only the type instead of an option object:**

```ts
pgm.addColumns('myTable', { age: 'integer' });
```

Equivalent to:

```ts
pgm.addColumns('myTable', { age: { type: 'integer' } });
```

**There is a shorthand for normal auto-increment IDs:**

```ts
pgm.addColumns('myTable', { id: 'id' });
```

Equivalent to:

```ts
pgm.addColumns('myTable', { id: { type: 'serial', primaryKey: true } });
```

## Methods

### Operation: `addColumns`

#### `pgm.addColumns( tablename, new_columns, options )`

> [!IMPORTANT]
> Add columns to an existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Alias: `addColumn`

#### Arguments

| Name          | Type                      | Description                                                                     |
| ------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `tablename`   | [Name](/migrations/#type) | Name of the table to alter                                                      |
| `new_columns` | `object`                  | Column names / options -- see [column definitions section](#column-definitions) |
| `options`     | `object`                  | Check below for available options                                               |

##### Options

| Option        | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `ifNotExists` | `boolean` | Adds column only if it does not exist |

### Reverse Operation: `dropColumns`

#### `pgm.dropColumns( tablename, columns, options )`

> [!IMPORTANT]
> Drop columns from a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Alias: `dropColumn`

#### Arguments

| Name        | Type                           | Description                              |
| ----------- | ------------------------------ | ---------------------------------------- |
| `tablename` | [Name](/migrations/#type)      | Name of the table to alter               |
| `columns`   | `array of strings` or `object` | Columns to drop (if objected, uses keys) |
| `options`   | `object`                       | Check below for available options        |

##### Options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | Drops column only if it exists |
| `cascade`  | `boolean` | Drop also dependent objects    |

### Operation: `renameColumn`

#### `pgm.renameColumn( tablename, old_column_name, new_column_name )`

> [!IMPORTANT]
> Rename a column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> **Reverse Operation**: same operation in opposite direction

#### Arguments

| Name              | Type                      | Description         |
| ----------------- | ------------------------- | ------------------- |
| `tablename`       | [Name](/migrations/#type) | Name of the table   |
| `old_column_name` | `string`                  | Current column name |
| `new_column_name` | `string`                  | New column name     |

### Operation: `alterColumn`

#### `pgm.alterColumn( tablename, column_name, column_options )`

> [!IMPORTANT]
> Alter a column (default value, type, allow
> null) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

#### Arguments

| Name             | Type                      | Description                 |
| ---------------- | ------------------------- | --------------------------- |
| `tablename`      | [Name](/migrations/#type) | Name of the table           |
| `column_name`    | `string`                  | Column to alter             |
| `column_options` | `object`                  | Optional new column options |

##### Column Options

| Option              | Type                      | Description                                                                                    |
| ------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `default`           | [Value](#default-values)  | Sets the default. `null` drops it, omitting it keeps it. See [Default values](#default-values) |
| `type`              | `string`                  | New datatype                                                                                   |
| `notNull`           | `boolean`                 | Sets NOT NULL if true; drops it if false                                                       |
| `allowNull`         | `boolean`                 | Drops NOT NULL if true; false is ignored and warns unless `notNull: true`                      |
| `using`             | `string`                  | Adds USING clause to change values in column                                                   |
| `collation`         | `string`                  | Adds COLLATE clause to change values in column                                                 |
| `comment`           | `string`                  | Adds comment on column                                                                         |
| `sequenceGenerated` | `object or null or false` | Sets or drops identity column                                                                  |

Use `notNull: true` to disallow null values, and `notNull: false` or
`allowNull: true` to allow them. Omitting both options leaves nullability unchanged.
`allowNull: false` does not set `NOT NULL` and emits a warning unless
`notNull: true` is also supplied. If both options are `true` or both are `false`,
a warning explains that `notNull` takes precedence: `true` sets `NOT NULL`, and
`false` drops it.

##### `sequenceGenerated` Options

See [sequence options section](sequences.md#sequence-options),
You can also set `precedence` to `ALWAYS` or `BY DEFAULT`.
