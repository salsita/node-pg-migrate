# Extension Operations

### `pgm.createExtension( extension )`

> Install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createextension.html.html)

**Arguments:**

* `extension` _[string or array of strings]_ - name(s) of extensions to install

**Aliases:** `addExtension`
**Reverse Operation:** `dropExtension`

---

### `pgm.dropExtension( extension )`

> Un-install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropextension.html)

**Arguments:**

* `extension` _[string or array of strings]_ - name(s) of extensions to install
