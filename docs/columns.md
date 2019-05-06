# Column Operations

## Column Definitions

The `createTable` and `addColumns` methods both take a `columns` argument that specifies column names and options. It is a object (key/value) where each key is the name of the column, and the value is another object that defines the options for the column.

- `type` _[string]_ - data type (use normal postgres types)
- `collation` _[string]_ - collation of data type
- `unique` _[boolean]_ - set to true to add a unique constraint on this column
- `primaryKey` _[boolean]_ - set to true to make this column the primary key
- `notNull` _[boolean]_ - set to true to make this column not null
- `default` _[string]_ - adds DEFAULT clause for column. Accepts null, a literal value, or a `pgm.func()` expression.
- `check` _[string]_ - sql for a check constraint for this column
- `references` _[[Name](migrations.md#type)]_ - a table name that this column is a foreign key to
- `referencesConstraintName` _[string]_ - name of the created constraint
- `onDelete` _[string]_ - adds ON DELETE constraint for a reference column
- `onUpdate` _[string]_ - adds ON UPDATE constraint for a reference column
- `match` _[string]_ - `FULL` or `SIMPLE`
- `deferrable` _[boolean]_ - flag for deferrable column constraint
- `deferred` _[boolean]_ - flag for initially deferred deferrable column constraint
- `comment` _[string]_ - adds comment on column
- `generated` _[object]_ - creates identity column
  - sequence options -- see [sequence options section](sequences.md#sequence-options)
  - `precedence` _[string]_ - `ALWAYS` or `BY DEFAULT`

## Data types & Convenience Shorthand

Data type strings will be passed through directly to postgres, so write types as you would if you were writing the queries by hand.

**There are some aliases on types to make things more foolproof:**
_(int, string, float, double, datetime, bool)_

**There is a shorthand to pass only the type instead of an options object:**
`pgm.addColumns('myTable', { age: 'integer' });`
is equivalent to
`pgm.addColumns('myTable', { age: { type: 'integer' } });`

**There is a shorthand for normal auto-increment IDs:**
`pgm.addColumns('myTable', { id: 'id' });`
is equivalent to
`pgm.addColumns('myTable', { id: { type: 'serial', primaryKey: true } });`

## Methods

### `pgm.addColumns( tablename, new_columns, options )`

> Add columns to an existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `new_columns` _[object]_ - column names / options -- see [column definitions section](#column-definitions)
- `options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ adds column only if it does not exist

**Aliases:** `addColumn`
**Reverse Operation:** `dropColumns`

---

### `pgm.dropColumns( tablename, columns, options )`

> Drop columns from a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `columns` _[array of strings or object]_ - columns to drop (if object, uses keys)
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops column only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

**Aliases:** `dropColumn`

---

### `pgm.renameColumn( tablename, old_column_name, new_column_name )`

> Rename a column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `old_column_name` _[string]_ - current column name
- `new_column_name` _[string]_ - new column name

**Reverse Operation:** same operation in opposite direction

---

### `pgm.alterColumn( tablename, column_name, column_options )`

> Alter a column (default value, type, allow null) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `column_name` _[string]_ - column to alter
- `column_options` _[object]_ - optional new column options
  - `default` _[string or null]_ - null, string
  - `type` _[string]_ - new datatype
  - `notNull` _[boolean]_ - sets NOT NULL if true or NULL if false
  - `allowNull` _[boolean]_ - sets NULL if true (alternative to `notNull`)
  - `using` _[string]_ - adds USING clause to change values in column
  - `collation` _[string]_ - adds COLLATE clause to change values in column
  - `comment` _[string]_ - adds comment on column
  - `generated` _[object or null]_ - sets or drops identity column
    - sequence options -- see [sequence options section](sequences.md#sequence-options)
    - `precedence` _[string]_ - `ALWAYS` or `BY DEFAULT`
