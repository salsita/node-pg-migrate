# Extension Operations

### `pgm.createExtension( extension )`

> Install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createextension.html.html)

**Arguments:**

- `extension` _[string or array of strings]_ - name(s) of extensions to install
- `options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - default `false`
  - `schema` _[string]_ - the name of the schema in which to install the extension's objects

**Aliases:** `addExtension`
**Reverse Operation:** `dropExtension`

---

### `pgm.dropExtension( extension )`

> Un-install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropextension.html)

**Arguments:**

- `extension` _[string or array of strings]_ - name(s) of extensions to install
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops extension only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects
