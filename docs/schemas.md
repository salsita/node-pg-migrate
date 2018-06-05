# Schema Operations

### `pgm.createSchema( schema_name, schema_options )`

> Create a new schema - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createschema.html)

**Arguments:**

- `schema_name` _[string]_ - name of the new schema
- `schema_options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - adds `IF NOT EXISTS` clause
  - `authorization` _[string]_ - alternative user to own new schema

**Reverse Operation:** `dropSchema`

---

### `pgm.dropSchema( schema_name, drop_options )`

> Drop a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropschema.html)

**Arguments:**

- `schema_name` _[string]_ - name of the schema to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops schema only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameSchema( old_schema_name, new_schema_name )`

> Rename a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterschema.html)

**Arguments:**

- `old_schema_name` _[string]_ - old name of the schema
- `new_schema_name` _[string]_ - new name of the schema
