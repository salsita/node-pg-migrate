# Table Operations

### `pgm.createTable( tablename, columns, options )`

> Create a new table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtable.html)

**Arguments:**

- `tablename` _[string]_ - name for the new table
- `columns` _[object]_ - column names / options -- see [column definitions section](columns.md#column-definitions)
- `options` _[object]_ - table options (optional)
  - `temporary` _[bool]_ - default false
  - `ifNotExists` _[bool]_ - default false
  - `inherits` _[string]_ - table(s) to inherit from
  - `constraints` _[object]_ - table constraints see [add constraint](constraints.md#pgmaddconstraint-tablename-constraint_name-expression-)
  - `like` _[string]_ - table(s) to inherit from
  - `comment` _[string]_ - adds comment on table

**Reverse Operation:** `dropTable`

---

### `pgm.dropTable( tablename, options )`

> Drop existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptable.html)

**Arguments:**

- `tablename` _[string]_ - name of the table to drop
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops table only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameTable( tablename, new_tablename )`

> Rename a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[string]_ - name of the table to rename
- `new_table` _[string]_ - new name of the table

**Reverse Operation:** same operation in opposite direction

---

### `pgm.alterTable( tablename, options )`

> Alter existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[string]_ - name of the table to alter
- `options` _[object]_ - options:
  - `levelSecurity` _[string]_ - `DISABLE`, `ENABLE`, `FORCE`, or `NO FORCE`
