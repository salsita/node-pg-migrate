# Function Operations

### `pgm.createFunction( function_name, function_params, function_options, definition )`

> Create a new function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createfunction.html)

**Arguments:**

- `function_name` _[[Name](migrations.md#type)]_ - name of the new function
- `function_params` _[array]_ - parameters of the new function

  Either array of strings or objects.
  If array of strings, it is interpreted as is, if array of objects:

  - `mode` _[string]_ - `IN`, `OUT`, `INOUT`, or `VARIADIC`
  - `name` _[string]_ - name of argument
  - `type` _[string]_ - datatype of argument
  - `default` _[string]_ - default value of argument

- `function_options` _[object]_ - options:
  - `returns` _[string]_ - returns clause
  - `language` _[string]_ - language name of function definition
  - `replace` _[boolean]_ - create or replace function
  - `window` _[boolean]_ - window function
  - `behavior` _[string]_ - `IMMUTABLE`, `STABLE`, or `VOLATILE`
  - `onNull` _[boolean]_ - `RETURNS NULL ON NULL INPUT`
  - `parallel` _[string]_ - `UNSAFE`, `RESTRICTED`, or `SAFE`
- `definition` _[string]_ - definition of function

**Reverse Operation:** `dropFunction`

---

### `pgm.dropFunction( function_name, function_params, drop_options )`

> Drop a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropfunction.html)

**Arguments:**

- `function_name` _[[Name](migrations.md#type)]_ - name of the function to drop
- `function_params` _[array]_ - [see](#pgmcreatefunction-function_name-function_params-function_options-definition-)
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops function only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.renameFunction( old_function_name, function_params, new_function_name )`

> Rename a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterfunction.html)

**Arguments:**

- `old_function_name` _[[Name](migrations.md#type)]_ - old name of the function
- `function_params` _[array]_ - [see](#pgmcreatefunction-function_name-function_params-function_options-definition-)
- `new_function_name` _[[Name](migrations.md#type)]_ - new name of the function
