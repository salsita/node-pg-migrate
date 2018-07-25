# Domain Operations

### `pgm.createDomain( domain_name, type, options )`

> Create a new domain - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createdomain.html)

**Arguments:**

- `domain_name` _[[Name](migrations.md#type)]_ - name of the new domain
- `type` _[string]_ - type of the new domain
- `options` _[object]_ - options:
  - `default` _[string]_ - default value of domain
  - `collation` _[string]_ - collation of data type
  - `notNull` _[boolean]_ - sets NOT NULL if true ([not recommended](https://www.postgresql.org/docs/10/static/sql-createdomain.html#idm46428678330368))
  - `check` _[string]_ - sql for a check constraint for this column
  - `constraintName` _[string]_ - name for constraint

**Reverse Operation:** `dropDomain`

---

### `pgm.dropDomain( domain_name, drop_options )`

> Drop a domain - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropdomain.html)

**Arguments:**

- `domain_name` _[[Name](migrations.md#type)]_ - name of the the domain to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops domain only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.alterDomain( domain_name, type, options )`

> Alter a domain - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterdomain.html)

**Arguments:**

- `domain_name` _[[Name](migrations.md#type)]_ - name of the new domain
- `options` _[object]_ - options:
  - `default` _[string]_ - default value of domain
  - `collation` _[string]_ - collation of data type
  - `notNull` _[boolean]_ - sets NOT NULL if true or NULL if false
  - `allowNull` _[boolean]_ - sets NULL if true (alternative to `notNull`)
  - `check` _[string]_ - sql for a check constraint for this column
  - `constraintName` _[string]_ - name for constraint

---

### `pgm.renameDomain( old_domain_name, new_domain_name )`

> Rename a domain - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterdomain.html)

**Arguments:**

- `old_domain_name` _[[Name](migrations.md#type)]_ - old name of the domain
- `new_domain_name` _[[Name](migrations.md#type)]_ - new name of the domain
