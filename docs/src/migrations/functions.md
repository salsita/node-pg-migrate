# Function Operations

## Operation: `createFunction`

#### `pgm.createFunction( function_name, function_params, function_options, definition )`

> [!IMPORTANT]
> Create a new function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createfunction.html)

### Arguments

| Name               | Type                            | Description                       |
| ------------------ | ------------------------------- | --------------------------------- |
| `function_name`    | [Name](/migrations/#type)       | name of the new function          |
| `function_params`  | `array[string]` `array[object]` | parameters of the new function    |
| `function_options` | `object`                        | Check below for available options |
| `definition`       | `string`                        | definition of function            |

### function_params

Either array of strings or objects.
If array of strings, it is interpreted as is, if array of objects:

| Option    | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| `mode`    | `string` | `IN`, `OUT`, `INOUT`, or `VARIADIC` |
| `name`    | `string` | name of argument                    |
| `type`    | `string` | datatype of argument                |
| `default` | `string` | default value of argument           |

### function_options

| Option     | Type      | Description                          |
| ---------- | --------- | ------------------------------------ |
| `returns`  | `string`  | returns clause                       |
| `language` | `string`  | language name of function definition |
| `replace`  | `boolean` | create or replace function           |
| `window`   | `boolean` | window function                      |
| `behavior` | `string`  | `IMMUTABLE`, `STABLE`, or `VOLATILE` |
| `security` | `string`  | `INVOKER` or `DEFINER`               |
| `onNull`   | `boolean` | `RETURNS NULL ON NULL INPUT`         |
| `parallel` | `string`  | `UNSAFE`, `RESTRICTED`, or `SAFE`    |

## Reverse Operation: `dropFunction`

#### `pgm.dropFunction( function_name, function_params, drop_options )`

> [!IMPORTANT]
> Drop a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropfunction.html)

### Arguments

| Name              | Type                            | Description                       |
| ----------------- | ------------------------------- | --------------------------------- |
| `function_name`   | [Name](/migrations/#type)       | name of the function to drop      |
| `function_params` | `array[string]` `array[object]` | parameters of the function        |
| `drop_options`    | `object`                        | Check below for available options |

### drop_options

| Option     | Type      | Description                      |
| ---------- | --------- | -------------------------------- |
| `ifExists` | `boolean` | drops function only if it exists |
| `cascade`  | `boolean` | drops also dependent objects     |

## Operation: `alterFunction`

#### `pgm.renameFunction( old_function_name, function_params, new_function_name )`

> [!IMPORTANT]
> Rename a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterfunction.html)

### Arguments

| Name                | Type                            | Description                |
| ------------------- | ------------------------------- | -------------------------- |
| `old_function_name` | [Name](/migrations/#type)       | old name of the function   |
| `function_params`   | `array[string]` `array[object]` | parameters of the function |
| `new_function_name` | [Name](/migrations/#type)       | new name of the function   |
