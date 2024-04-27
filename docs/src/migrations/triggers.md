# Trigger Operations

### `pgm.createTrigger( table_name, trigger_name, trigger_options )`

> Create a new trigger - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createtrigger.html)

**Arguments:**

- `table_name` _[[Name](migrations.md#type)]_ - name of the table where the new trigger will live
- `trigger_name` _[string]_ - name of the new trigger
- `trigger_options` _[object]_ - options:
  - `when` _[string]_ - `BEFORE`, `AFTER`, or `INSTEAD OF`
  - `operation` _[string or array of strings]_ - `INSERT`, `UPDATE[ OF ...]`, `DELETE` or `TRUNCATE`
  - `constraint` _[boolean]_ - creates constraint trigger
  - `function` _[[Name](migrations.md#type)]_ - the name of procedure to execute
  - `functionParams` _[array]_ - parameters of the procedure
  - `level` _[string]_ - `STATEMENT`, or `ROW`
  - `condition` _[string]_ - condition to met to execute trigger
  - `deferrable` _[boolean]_ - flag for deferrable constraint trigger
  - `deferred` _[boolean]_ - flag for initially deferred deferrable constraint trigger
- `definition` _[string]_ - optional definition of function which will be created with same name as trigger

**Reverse Operation:** `dropTrigger`

---

### `pgm.dropTrigger( table_name, trigger_name, drop_options )`

> Drop a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptrigger.html)

**Arguments:**

- `table_name` _[[Name](migrations.md#type)]_ - name of the table where the trigger lives
- `trigger_name` _[string]_ - name of the trigger to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops trigger only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameTrigger( table_name, old_trigger_name, new_trigger_name )`

> Rename a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertrigger.html)

**Arguments:**

- `table_name` _[[Name](migrations.md#type)]_ - name of the table where the trigger lives
- `old_trigger_name` _[string]_ - old name of the trigger
- `new_trigger_name` _[string]_ - new name of the trigger
