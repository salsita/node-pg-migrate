# Type Operations

### `pgm.createType( type_name, values )`

> Create a new data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the new type
- `values` _[array of strings or object]_ if an array the contents are possible values for an enum type, if an object names and types for a composite type

**Aliases:** `addType`
**Reverse Operation:** `dropType`

---

### `pgm.dropType( type_name )`

> Drop a custom data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the new type

---

### `pgm.renameType( type_name, new_type_name )`

> Rename a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type to rename
- `new_type_name` _[[Name](migrations.md#type)]_ - name of the new type

---

### `pgm.addTypeAttribute( type_name, attribute_name, attribute_type )`

> Add attribute to an existing data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to add
- `attribute_type` _[string]_ - type of the attribute to add

---

### `pgm.dropTypeAttribute( type_name, attribute_name, options )`

> Drop attribute from a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to drop
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - default false

---

### `pgm.setTypeAttribute( type_name, attribute_name, attribute_type )`

> Set data type of an existing attribute of data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute
- `attribute_type` _[string]_ - new type of the attribute

---

### `pgm.addTypeValue( type_name, value, options )`

> Add value to a list of enum data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `value` _[string]_ - value to add to list
- `options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - default false
  - `before` _[string]_ - value before which the new value should be add
  - `after` _[string]_ - value after which the new value should be add

---

### `pgm.renameTypeAttribute( type_name, attribute_name, new_attribute_name )`

> Rename an attribute of data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to rename
- `new_attribute_name` _[string]_ - new name of the attribute

---

### `pgm.renameTypeValue( type_name, value, new_value )`

> Rename a value of enum data type - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**

- `type_name` _[[Name](migrations.md#type)]_ - name of the type
- `value` _[string]_ - value to rename
- `new_value` _[string]_ - new value
