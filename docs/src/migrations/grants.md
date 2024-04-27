# Grant Operations

### `pgm.grantRoles( roles_from, roles_to, grant_roles_options )`

> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

**Arguments:**

- `roles_from` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
- `roles_to` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
- `grant_roles_options` _[object]_ - options:
  - `withAdminOption` _[boolean]_ - default false
  - `onlyAdminOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - default false

**Reverse Operation:** `revokeRoles`

---

### `pgm.revokeRoles( roles, roles_from, drop_options )`

> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

**Arguments:**

- `roles` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
- `roles_from` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
- `drop_options` _[object]_ - options:
  - `onlyAdminOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.grantOnTables( grant_options )`

> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

**Arguments:**

- `grant_options` _[object]_ - options:
  - `tables` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)] or [ALL]_ - names of tables
  - `schema` _[string]_ - if tables ALL, then schema name is required
  - `privileges` _[array of TablePrivileges] or [ALL]_ - list of privileges
  - `roles` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
  - `withGrantOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - default false

**Reverse Operation:** `revokeOnTables`

---

### `pgm.revokeOnTables( revoke_options )`

> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

**Arguments:**

- `revoke_options` _[object]_ - options:
  - `tables` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)] or [ALL]_ - names of tables
  - `schema` _[string]_ - if tables ALL, then schema name is required
  - `privileges` _[array of TablePrivileges] or [ALL]_ - list of privileges
  - `roles` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
  - `withGrantOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.grantOnSchemas( grant_options )`

> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

**Arguments:**

- `grant_options` _[object]_ - options:
  - `schemas` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)] or [ALL]_ - names of schemas
  - `privileges` _[array of SchemaPrivileges] or [ALL]_ - list of privileges
  - `roles` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
  - `withGrantOption` _[boolean]_ - default false
  - `onlyGrantOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - default false

**Reverse Operation:** `revokeOnSchemas`

---

### `pgm.revokeOnSchemas( revoke_options )`

> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

**Arguments:**

- `revoke_options` _[object]_ - options:
  - `schemas` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)] or [ALL]_ - names of schemas
  - `privileges` _[array of SchemaPrivileges] or [ALL]_ - list of privileges
  - `roles` _[[Name](/migrations/#type) or array of [Names](/migrations/#type)]_ - names of roles
  - `withGrantOption` _[boolean]_ - default false
  - `onlyGrantOption` _[boolean]_ - default false
  - `cascade` _[boolean]_ - drops also dependent objects
