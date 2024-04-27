# Materialized View Operations

### `pgm.createMaterializedView( viewName, options, definition )`

> Create a new materialized view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-creatematerializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the new materialized view
- `options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - default false
  - `columns` _[string or array]_ - use if you want to name columns differently then inferred from definition
  - `tablespace` _[string]_ - optional
  - `storageParameters` _[object]_ - optional key value pairs of [Storage Parameters](https://www.postgresql.org/docs/current/static/sql-createtable.html#SQL-CREATETABLE-STORAGE-PARAMETERS)
  - `data` _[boolean]_ - default undefined
- `definition` _[string]_ - SQL of SELECT statement

**Reverse Operation:** `dropMaterializedView`

---

### `pgm.dropMaterializedView( viewName, options )`

> Drop a materialized view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropmaterializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to delete
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops view only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.alterMaterializedView( viewName, options )`

> Alter a materialized view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to alter
- `options` _[object]_ - options:
  - `cluster` _[string]_ - optional index name for clustering
  - `extension` _[string]_ - optional name of extension view is dependent on
  - `storageParameters` _[object]_ - optional key value (`null` to reset) pairs of [Storage Parameters](https://www.postgresql.org/docs/current/static/sql-createtable.html#SQL-CREATETABLE-STORAGE-PARAMETERS)

---

### `pgm.renameMaterializedView( viewName, newViewName )`

> Rename a materialized view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - old name of the view
- `newViewName` _[[Name](migrations.md#type)]_ - new name of the view

---

### `pgm.renameMaterializedViewColumn( viewName, columnName, newColumnName )`

> Rename a materialized view column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - name of the view to alter
- `columnName` _[string]_ - current column name
- `newColumnName` _[string]_ - new column name

---

### `pgm.refreshMaterializedView( viewName, options )`

> Refreshes a materialized view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-refreshmaterializedview.html)

**Arguments:**

- `viewName` _[[Name](migrations.md#type)]_ - old name of the view
- `options` _[object]_ - options:
  - `concurrently` _[boolean]_ - default false
  - `data` _[boolean]_ - default undefined
