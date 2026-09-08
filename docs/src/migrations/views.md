# View Operations

## Operation: `createView`

#### `pgm.createView( viewName, options, definition )`

> [!IMPORTANT]
> Create a new view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createview.html)

### Arguments

| Name         | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `viewName`   | `string` | name of the new view              |
| `options`    | `object` | Check below for available options |
| `definition` | `string` | SQL of SELECT statement           |

### Options

| Option        | Type                | Description                                                                                    |
| ------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `temporary`   | `boolean`           | adds `TEMPORARY` clause                                                                        |
| `replace`     | `boolean`           | adds `OR REPLACE` clause                                                                       |
| `recursive`   | `boolean`           | adds `RECURSIVE` clause                                                                        |
| `columns`     | `string` or `array` | use if you want to name columns differently then inferred from definition                      |
| `options`     | `object`            | key value pairs of [View Options](https://www.postgresql.org/docs/current/sql-createview.html) |
| `checkOption` | `string`            | `CASCADED` or `LOCAL`                                                                          |

## Reverse Operation: `dropView`

#### `pgm.dropView( viewName, options )`

> [!IMPORTANT]
> Drop a view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropview.html)

### Arguments

| Name       | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `viewName` | `string` | name of the view to delete        |
| `options`  | `object` | Check below for available options |

### Options

| Option     | Type      | Description                  |
| ---------- | --------- | ---------------------------- |
| `ifExists` | `boolean` | drops view only if it exists |
| `cascade`  | `boolean` | drops also dependent objects |

## Operation: `alterView`

#### `pgm.alterView( viewName, options )`

> [!IMPORTANT]
> Alter a view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterview.html)

### Arguments

| Name       | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `viewName` | `string` | name of the view to alter         |
| `options`  | `object` | Check below for available options |

### Options

| Option        | Type     | Description                                                                                                     |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `checkOption` | `string` | `CASCADED`, `LOCAL` or `null` to reset                                                                          |
| `options`     | `object` | key value (`null` to reset) pairs of [View Options](https://www.postgresql.org/docs/current/sql-alterview.html) |

## Operation: `alterViewColumn`

#### `pgm.alterViewColumn( viewName, columnName, options )`

> [!IMPORTANT]
> Alter a view column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterview.html)

### Arguments

| Name         | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `viewName`   | `string` | name of the view to alter         |
| `columnName` | `string` | name of the column to alter       |
| `options`    | `object` | Check below for available options |

### Options

| Option    | Type     | Description             |
| --------- | -------- | ----------------------- |
| `default` | `string` | default value of column |

## Operation: `renameView`

#### `pgm.renameView( viewName, newViewName )`

> [!IMPORTANT]
> Rename a view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterview.html)

### Arguments

| Name          | Type                      | Description          |
| ------------- | ------------------------- | -------------------- |
| `viewName`    | [Name](/migrations/#type) | old name of the view |
| `newViewName` | [Name](/migrations/#type) | new name of the view |

The destination name is unqualified in the generated SQL. If a destination object
specifies a schema, it must match the source schema. Use `{ schema, name }` for
schema-qualified names so automatic reversal preserves the source schema;
the schema cannot be inferred from a string name or the database search path.

Qualified `PgLiteral` names can produce invalid SQL, including during automatic
reversal. Use structured name objects instead, or use `pgm.sql` with explicit SQL
in both your up and down migrations.

To move a view between schemas, use SQL explicitly, for example
`pgm.sql('ALTER VIEW "old_schema"."my_view" SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.
