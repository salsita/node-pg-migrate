# Column Operations

## Column Definitions

The `createTable` and `addColumns` methods both take a `columns` argument that specifies column names and options.
It is an object (key/value) where each key is the name of the column,
and the value is another object that defines the options for the column.

| Option                        | Type                                  | Description                                                                                  |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `type`                        | `string`                              | Data type (use normal postgres types)                                                        |
| `collation`                   | `string`                              | Collation of data type                                                                       |
| `unique`                      | `boolean`                             | Set to true to add a unique constraint on this column                                        |
| `primaryKey`                  | `boolean`                             | Set to true to make this column the primary key                                              |
| `notNull`                     | `boolean`                             | Set to true to make this column not null                                                     |
| `default`                     | `string`                              | Adds DEFAULT clause for column. Accepts null, a literal value, or a `pgm.func()` expression. |
| `check`                       | `string`                              | SQL for a check constraint for this column                                                   |
| `references`                  | [Name](/migrations/#type) or `string` | A table name that this column is a foreign key to                                            |
| `referencesConstraintName`    | `string`                              | Name of the created constraint                                                               |
| `referencesConstraintComment` | `string`                              | Comment on the created constraint                                                            |
| `onDelete`                    | `string`                              | Adds ON DELETE constraint for a reference column                                             |
| `onUpdate`                    | `string`                              | Adds ON UPDATE constraint for a reference column                                             |
| `match`                       | `string`                              | `FULL` or `SIMPLE`                                                                           |
| `deferrable`                  | `boolean`                             | Flag for deferrable column constraint                                                        |
| `deferred`                    | `boolean`                             | Flag for initially deferred deferrable column constraint                                     |
| `comment`                     | `string`                              | Adds comment on column                                                                       |
| `expressionGenerated`         | `string`                              | Expression to compute column value                                                           |
| `sequenceGenerated`           | `object`                              | Creates identity column see [sequence options section](sequences.md#sequence-options)        |
| `precedence`                  | `string`                              | `ALWAYS` or `BY DEFAULT`                                                                     |

## Data types & Convenience Shorthand

Data type strings will be passed through directly to postgres, so write types as you would if you were writing the
queries by hand.

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

| Option              | Type                      | Description                                    |
| ------------------- | ------------------------- | ---------------------------------------------- |
| `default`           | `string or null`          | null, string                                   |
| `type`              | `string`                  | New datatype                                   |
| `notNull`           | `boolean`                 | Sets NOT NULL if true or NULL if false         |
| `allowNull`         | `boolean`                 | Sets NULL if true (alternative to `notNull`)   |
| `using`             | `string`                  | Adds USING clause to change values in column   |
| `collation`         | `string`                  | Adds COLLATE clause to change values in column |
| `comment`           | `string`                  | Adds comment on column                         |
| `sequenceGenerated` | `object or null or false` | Sets or drops identity column                  |

##### `sequenceGenerated` Options

See [sequence options section](sequences.md#sequence-options),
You can also set `precedence` to `ALWAYS` or `BY DEFAULT`.
