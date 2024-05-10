# Table Operations

## Operation: `createTable`

#### `pgm.createTable( tablename, columns, options )`

> [!IMPORTANT]
> Create a new table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtable.html)

### Arguments

| Name        | Type                      | Description                                                                               |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `tablename` | [Name](/migrations/#type) | name for the new table                                                                    |
| `columns`   | `object`                  | column names / options -- see [column definitions section](columns.md#column-definitions) |
| `options`   | `object`                  | table options (optional)                                                                  |

### Options

| Option        | Type                                  | Description                                                                                                                   |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `temporary`   | `boolean`                             | default `false`                                                                                                               |
| `ifNotExists` | `boolean`                             | default `false`                                                                                                               |
| `inherits`    | [Name](/migrations/#type)             | table(s) to inherit from                                                                                                      |
| `constraints` | `object`                              | table constraints see `expression` of [add constraint](constraints.md#pgmaddconstraint-tablename-constraint_name-expression-) |
| `like`        | [Name](/migrations/#type) or `object` | table(s) to inherit from or object with `table` and `options` keys                                                            |
| `comment`     | `string`                              | adds comment on table                                                                                                         |

#### like options

| Option      | Type                        | Description                                                                                  |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `including` | `string` or `array[string]` | 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL' |
| `excluding` | `string` or `array[string]` | 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL' |

## Reverse Operation: `dropTable`

#### `pgm.dropTable( tablename, options )`

> [!IMPORTANT]
> Drop existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptable.html)

### Arguments

| Name        | Type                      | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `tablename` | [Name](/migrations/#type) | name of the table to drop         |
| `options`   | `object`                  | Check below for available options |

### Options

| Option     | Type      | Description                   |
| ---------- | --------- | ----------------------------- |
| `ifExists` | `boolean` | drops table only if it exists |
| `cascade`  | `boolean` | drops also dependent objects  |

## Operation: `renameTable`

#### `pgm.renameTable( tablename, new_tablename )`

> [!IMPORTANT]
> Rename a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Reverse Operation: same operation in opposite direction

### Arguments

| Name            | Type                      | Description                 |
| --------------- | ------------------------- | --------------------------- |
| `tablename`     | [Name](/migrations/#type) | name of the table to rename |
| `new_tablename` | [Name](/migrations/#type) | new name of the table       |

## Operation: `alterTable`

#### `pgm.alterTable( tablename, options )`

> [!IMPORTANT]
> Alter existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

### Arguments

| Name        | Type                      | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `tablename` | [Name](/migrations/#type) | name of the table to alter        |
| `options`   | `object`                  | Check below for available options |

### Options

| Option          | Type     | Description                                 |
| --------------- | -------- | ------------------------------------------- |
| `levelSecurity` | `string` | `DISABLE`, `ENABLE`, `FORCE`, or `NO FORCE` |
