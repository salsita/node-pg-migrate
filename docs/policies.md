# Policies Operations

### `pgm.createPolicy( tableName, policyName, options )`

> Create a new policy - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createpolicy.html)

**Arguments:**

- `tableName` _[[Name](migrations.md#type)]_ - name of the table to alter
- `policyName` _[string]_ - name of the new policy
- `options` _[object]_ - options:
  - `command` _[string]_ - `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`
  - `role` _[string or array]_ - the role(s) to which the policy is to be applied
  - `using` _[string]_ - SQL conditional expression for visibility check
  - `check` _[string]_ - SQL conditional expression for insert/update check

**Reverse Operation:** `dropPolicy`

---

### `pgm.dropPolicy( tableName, policyName, options )`

> Drop a policy - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droppolicy.html)

**Arguments:**

- `tableName` _[[Name](migrations.md#type)]_ - name of the table where the policy is
- `policyName` _[string]_ - name of the policy to delete
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops policy only if it exists

---

### `pgm.alterPolicy( tableName, policyName, options )`

> Alter a policy - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterpolicy.html)

**Arguments:**

- `tableName` _[[Name](migrations.md#type)]_ - name of the table where the policy is
- `policyName` _[string]_ - name of the policy to alter
- `options` _[object]_ - options:
  - `role` _[string or array]_ - the role(s) to which the policy is to be applied
  - `using` _[string]_ - SQL conditional expression for visibility check
  - `check` _[string]_ - SQL conditional expression for insert/update check

---

### `pgm.renamePolicy( tableName, policyName, newPolicyName )`

> Rename a policy - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterpolicy.html)

**Arguments:**

- `tableName` _[[Name](migrations.md#type)]_ - name of the table where the policy is
- `policyName` _[string]_ - old name of the policy
- `newPolicyName` _[string]_ - new name of the policy
