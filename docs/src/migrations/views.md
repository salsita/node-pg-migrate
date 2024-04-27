# View Operations

### `pgm.createView( viewName, options, definition )`

> Create a new view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the new view
- `options` _[object]_ - options:
  - `temporary` _[boolean]_ - default false
  - `replace` _[boolean]_ - default false
  - `recursive` _[boolean]_ - default false
  - `columns` _[string or array]_ - use if you want to name columns differently then inferred from definition
  - `options` _[object]_ - key value pairs of [View Options](https://www.postgresql.org/docs/current/sql-createview.html)
  - `checkOption` _[string]_ - `CASCADED` or `LOCAL`
- `definition` _[string]_ - SQL of SELECT statement

**Reverse Operation:** `dropView`

---

### `pgm.dropView( viewName, options )`

> Drop a view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to delete
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops view only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.alterView( viewName, options )`

> Alter a view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to alter
- `options` _[object]_ - options:
  - `checkOption` _[string]_ - `CASCADED`, `LOCAL` or `null` to reset
  - `options` _[object]_ - key value (`null` to reset) pairs of [View Options](https://www.postgresql.org/docs/current/sql-alterview.html)

---

### `pgm.alterViewColumn( viewName, columnName, options )`

> Alter a view column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to alter
- `columnName` _[string]_ - name of the column to alter
- `options` _[object]_ - options:
  - `default` _[string]_ - default value of column

---

### `pgm.renameView( viewName, newViewName )`

> Rename a view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - old name of the view
- `newViewName` _[[Name](migrations.md#type)]_ - new name of the view
