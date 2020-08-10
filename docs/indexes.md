# Index Operations

### `pgm.createIndex( tablename, columns, options )`

> Create a new index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createindex.html)

**Arguments:**

- `tablename` _[[Name](migrations.md#type)]_ - name of the table to alter
- `columns` _[string or array of (array of) strings]_ - columns to add to the index with optional operator class (_[Name](migrations.md#type)_) and sort (_string_)

  Examples:

  - `pgm.createIndex('table', 'column')` => `CREATE INDEX ON "table" ("column")`
  - `pgm.createIndex('table', ['col1', 'col2'])` => `CREATE INDEX ON "table" ("col1", "col2")`
  - `pgm.createIndex('table', [{ name: 'col1', sort: 'ASC' }], { name: 'col2', sort: 'DESC' }])` => `CREATE INDEX ON "table" ("col1" ASC, "col2" DESC)`
  - `pgm.createIndex('table', [{ name: 'col1', opclass: { schema: 'schema'; name: 'opclass' }, sort: 'ASC' }])` => `CREATE INDEX ON "table" ("col1" "schema"."opclass" ASC)`

- `options` _[index options]_ - optional options:
  - `name` _[string]_ - name for the index (one will be inferred from table/columns if undefined)
  - `unique` _[boolean]_ - set to true if this is a unique index
  - `where` _[string]_ - raw sql for where clause of index
  - `concurrently` _[boolean]_ - create this index concurrently
  - `ifNotExists` _[bool]_ - default false
  - `method` _[string]_ - btree | hash | gist | spgist | gin
  - `include` _[string or array of strings]_ - columns to add to the include clause

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
