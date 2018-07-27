# Index Operations

### `pgm.createIndex( tablename, columns, options )`

> Create a new index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createindex.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `columns` _[string or array of strings]_ - columns to add to the index
- `options` _[index options]_ - optional options:
  - `name` _[string]_ - name for the index (one will be inferred from table/columns if undefined)
  - `unique` _[boolean]_ - set to true if this is a unique index
  - `where` _[string]_ - raw sql for where clause of index
  - `concurrently` _[boolean]_ - create this index concurrently
  - `opclass` _[string]_ - name of an operator class to use
  - `method` _[string]_ - btree | hash | gist | spgist | gin

**Aliases:** `addIndex`
**Reverse Operation:** `dropIndex`

---

### `pgm.dropIndex( tablename, columns, options )`

> Drop an index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropindex.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `columns` _[string or array of strings]_ - column names, used only to infer an index name
- `options` _[index options]_ - optional options:
  - `name` _[string]_ - name of the index to drop
