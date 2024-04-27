# Table Operations

### `pgm.createTable( tablename, columns, options )`

> Create a new table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name for the new table
- `columns` _[object]_ - column names / options -- see [column definitions section](columns.md#column-definitions)
- `options` _[object]_ - table options (optional)
  - `temporary` _[bool]_ - default false
  - `ifNotExists` _[bool]_ - default false
  - `inherits` _[[Name](migrations.md#type)]_ - table(s) to inherit from
  - `constraints` _[object]_ - table constraints see `expression` of [add constraint](constraints.md#pgmaddconstraint-tablename-constraint_name-expression-)
  - `like` either:
    - _[[Name](migrations.md#type)]_ - table(s) to inherit from
    - or _[object]_
      - `table` _[[Name](migrations.md#type)]_ - table(s) to inherit from
      - `options` _[object]_ - like options (optional)
        - `including` _[string or array of strings]_ - 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL'
        - `excluding` _[string or array of strings]_ - 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL'
  - `comment` _[string]_ - adds comment on table

**Reverse Operation:** `dropTable`

---

### `pgm.dropTable( tablename, options )`

> Drop existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to drop
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops table only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameTable( tablename, new_tablename )`

> Rename a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to rename
- `new_table` _[[Name](migrations.md#type)]_ - new name of the table

**Reverse Operation:** same operation in opposite direction

---

### `pgm.alterTable( tablename, options )`

> Alter existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `options` _[object]_ - options:
  - `levelSecurity` _[string]_ - `DISABLE`, `ENABLE`, `FORCE`, or `NO FORCE`
