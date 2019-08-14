# Constraint Operations

### `pgm.addConstraint( tablename, constraint_name, expression )`

> Add a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `constraint_name` _[string]_ - name for the constraint
- `expression` _[string or object]_ - constraint expression (raw sql) or definition:
  - `check` _[string or array]_ - sql for a check constraint(s)
  - `unique` _[[Name](migrations.md#type) or array of [Names](migrations.md#type) or array of arrays of [Names](migrations.md#type)]_ - names of unique columns
  - `primaryKey` _[[Name](migrations.md#type) or array of [Names](migrations.md#type)]_ - names of primary columns
  - `exclude` _[string]_ - sql for an exclude constraint
  - `deferrable` _[boolean]_ - flag for deferrable table constraint
  - `deferred` _[boolean]_ - flag for initially deferred deferrable table constraint
  - `comment` _[string]_ - comment on a singular, named constraint
  - `foreignKeys` _[object or array of objects]_ - foreign keys specification
    - `columns` _[[Name](migrations.md#type) or array of [Names](migrations.md#type)]_ - names of columns
    - `references` _[[Name](migrations.md#type)]_ - names of foreign table and column names
    - `referencesConstraintName` _[string]_ - name of the created constraint (only necessary when creating multiple constraints)
    - `referencesConstraintComment` _[string]_ - comment on the individual foreign key constraint
    - `onDelete` _[string]_ - action to perform on delete
    - `onUpdate` _[string]_ - action to perform on update
    - `match` _[string]_ - `FULL` or `SIMPLE`

**Aliases:** `createConstraint`
**Reverse Operation:** `dropConstraint`

---

### `pgm.dropConstraint( tablename, constraint_name, options )`

> Drop a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `constraint_name` _[string]_ - name for the constraint
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops constraint only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

### `pgm.renameConstraint( tablename, old_constraint_name, new_constraint_name )`

---

> Rename a constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `old_constraint_name` _[string]_ - current constraint name
- `new_constraint_name` _[string]_ - new constraint name

**Reverse Operation:** same operation in opposite direction
