# Role Operations

### `pgm.createRole( role_name, role_options )`

> Create a new role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createrole.html)

**Arguments:**

- `role_name` _[[Name](migrations.md#type)]_ - name of the new role
- `role_options` _[object]_ - options:
  - `superuser` _[boolean]_ - default false
  - `createdb` _[boolean]_ - default false
  - `createrole` _[boolean]_ - default false
  - `inherit` _[boolean]_ - default true
  - `login` _[boolean]_ - default false
  - `replication` _[boolean]_ - default false
  - `bypassrls` _[boolean]_
  - `limit` _[number]_ -
  - `password` _[string]_ -
  - `encrypted` _[boolean]_ - default true
  - `valid` _[string]_ - timestamp
  - `inRole` _[string or array of strings]_ - role or array of roles
  - `role` _[string or array of strings]_ - role or array of roles
  - `admin` _[string or array of strings]_ - role or array of roles

**Reverse Operation:** `dropRole`

---

### `pgm.dropRole( role_name )`

> Drop a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droprole.html)

**Arguments:**

- `role_name` _[[Name](migrations.md#type)]_ - name of the new role

---

### `pgm.alterRole( role_name, role_options )`

> Alter a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

**Arguments:**

- `role_name` _[[Name](migrations.md#type)]_ - name of the new role
- `role_options` _[object]_ - [see](#pgmcreaterole-role_name-role_options-)

---

### `pgm.renameRole( old_role_name, new_role_name )`

> Rename a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

**Arguments:**

- `old_role_name` _[[Name](migrations.md#type)]_ - old name of the role
- `new_role_name` _[[Name](migrations.md#type)]_ - new name of the role
