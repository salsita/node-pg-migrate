# Operator Operations

### `pgm.createOperator( operator_name, options )`

> Create a new operator - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createoperator.html)

**Arguments:**

- `operator_name` _[[Name](migrations.md#type)]_ - name of the new operator
- `options` _[object]_ - options:
  - `procedure` _[[Name](migrations.md#type)]_ - name of procedure performing operation
  - `left` _[[Name](migrations.md#type)]_ - type of left argument
  - `right` _[[Name](migrations.md#type)]_ - type of right argument
  - `commutator` _[[Name](migrations.md#type)]_ - name of commutative operator
  - `negator` _[[Name](migrations.md#type)]_ - name of negating operator
  - `restrict` _[[Name](migrations.md#type)]_ - name of restriction procedure
  - `join` _[[Name](migrations.md#type)]_ - name of join procedure
  - `hashes` _[boolean]_ - adds `HASHES` clause
  - `merges` _[boolean]_ - adds `MERGES` clause

**Reverse Operation:** `dropOperator`

---

### `pgm.dropOperator( operator_name, drop_options )`

> Drop a operator - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropoperator.html)

**Arguments:**

- `operator_name` _[[Name](migrations.md#type)]_ - name of the operator to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops schema only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects
  - `left` _[[Name](migrations.md#type)]_ - type of left argument
  - `right` _[[Name](migrations.md#type)]_ - type of right argument

---

### `pgm.createOperatorClass( operator_class_name, type, index_method, operator_list, options )`

> Create a new operator class - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createopclass.html)

**Arguments:**

- `operator_class_name` _[[Name](migrations.md#type)]_ - name of the new operator class
- `type` _[string]_ - data type of the new operator class
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator class
- `operator_list` _[array]_ - of [operator objects](#operator-list-definitions)
- `options` _[object]_ - options:
  - `default` _[boolean]_ - adds `DEFAULT` clause
  - `family` _[string]_ - type of left argument

**Reverse Operation:** `dropOperatorClass`

---

### `pgm.dropOperatorClass( operator_class_name, index_methoddrop_options )`

> Drop a operator class - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropopclass.html)

**Arguments:**

- `operator_class_name` _[[Name](migrations.md#type)]_ - name of the operator class to drop
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator class
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops schema only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameOperatorClass( old_operator_class_name, index_method, new_operator_class_name )`

> Rename a operator class - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropclass.html)

**Arguments:**

- `old_operator_class_name` _[[Name](migrations.md#type)]_ - old name of the operator class
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator class
- `new_operator_class_name` _[[Name](migrations.md#type)]_ - new name of the operator class

---

### `pgm.createOperatorFamily( operator_family_name, index_method )`

> Create a new operator family - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createopfamily.html)

**Arguments:**

- `operator_family_name` _[[Name](migrations.md#type)]_ - name of the new operator family
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator family

**Reverse Operation:** `dropOperatorFamily`

---

### `pgm.dropOperatorFamily( operator_family_name, index_methoddrop_options )`

> Drop a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropopfamily.html)

**Arguments:**

- `operator_family_name` _[[Name](migrations.md#type)]_ - name of the operator family to drop
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator family
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops schema only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameOperatorFamily( old_operator_family_name, index_method, new_operator_family_name )`

> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

**Arguments:**

- `old_operator_family_name` _[[Name](migrations.md#type)]_ - old name of the operator family
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator family
- `new_operator_family_name` _[[Name](migrations.md#type)]_ - new name of the operator family

---

### `pgm.addToOperatorFamily( operator_family_name, index_method, operator_list )`

> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

**Arguments:**

- `operator_family_name` _[[Name](migrations.md#type)]_ - name of the operator family
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator family
- `operator_list` _[array]_ - of [operator objects](#operator-list-definitions)

---

### `pgm.removeFromOperatorFamily( operator_family_name, index_method, operator_list )`

> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

**Arguments:**

- `operator_family_name` _[[Name](migrations.md#type)]_ - name of the operator family
- `index_method` _[[Name](migrations.md#type)]_ - name of the index method of operator family
- `operator_list` _[array]_ - of [operator objects](#operator-list-definitions)

---

### Operator List Definitions

Some functions for defining operators take as parameter `operator_list` which is array of objects with following structure:

- `type` _[string]_ - `function` or `operator`
- `number` _[number]_ - index
- `name` _[[Name](migrations.md#type)]_ - name of operator or procedure
- `params` _[array]_ - list of argument types of operator or procedure
