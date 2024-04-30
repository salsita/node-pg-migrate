# Constraint Operations

## Operation: `addConstraint`

#### `pgm.addConstraint( tablename, constraint_name, expression )`

> [!IMPORTANT]
> Add a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Alias: `createConstraint`

### Arguments

| Name              | Type                      | Description                                                                                                  |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tablename`       | [Name](/migrations/#type) | Name of the table to alter                                                                                   |
| `constraint_name` | `string`                  | Name for the constraint                                                                                      |
| `expression`      | `string` or `object`      | Constraint expression (raw sql) or definition -- see [constraint definition section](#constraint-definition) |

#### Constraint Definition

| Option        | Type                                                     | Description                                                             |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `check`       | `string` or `array`                                      | SQL for a check constraint(s)                                           |
| `unique`      | `Name` or `array of Names` or `array of arrays of Names` | Names of unique columns                                                 |
| `primaryKey`  | `Name` or `array of Names`                               | Names of primary columns                                                |
| `exclude`     | `string`                                                 | SQL for an exclude constraint                                           |
| `deferrable`  | `boolean`                                                | Flag for deferrable table constraint                                    |
| `deferred`    | `boolean`                                                | Flag for initially deferred deferrable table constraint                 |
| `comment`     | `string`                                                 | Comment on a singular, named constraint                                 |
| `foreignKeys` | `object` or `array of objects`                           | Foreign keys specification -- see [foreign keys section](#foreign-keys) |

#### Foreign Keys

| Option                        | Type                       | Description                                                                        |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `columns`                     | `Name` or `array of Names` | Names of columns                                                                   |
| `references`                  | `Name`                     | Names of foreign table and column names                                            |
| `referencesConstraintName`    | `string`                   | Name of the created constraint (only necessary when creating multiple constraints) |
| `referencesConstraintComment` | `string`                   | Comment on the individual foreign key constraint                                   |
| `onDelete`                    | `string`                   | Action to perform on delete                                                        |
| `onUpdate`                    | `string`                   | Action to perform on update                                                        |
| `match`                       | `string`                   | `FULL` or `SIMPLE`                                                                 |

## Reverse Operation: `dropConstraint`

#### `pgm.dropConstraint( tablename, constraint_name, options )`

> [!IMPORTANT]
> Drop a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

### Arguments

| Name              | Type                      | Description                       |
| ----------------- | ------------------------- | --------------------------------- |
| `tablename`       | [Name](/migrations/#type) | Name of the table to alter        |
| `constraint_name` | `string`                  | Name of the constraint            |
| `options`         | `object`                  | Check below for available options |

#### Options

| Option     | Type      | Description                        |
| ---------- | --------- | ---------------------------------- |
| `ifExists` | `boolean` | Drops constraint only if it exists |
| `cascade`  | `boolean` | Drops also dependent objects       |

## Operation: `renameConstraint`

#### `pgm.renameConstraint( tablename, old_constraint_name, new_constraint_name )`

> [!IMPORTANT]
> Rename a constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Reverse Operation: same operation in opposite direction

### Arguments

| Name                  | Type                      | Description                |
| --------------------- | ------------------------- | -------------------------- |
| `tablename`           | [Name](/migrations/#type) | Name of the table to alter |
| `old_constraint_name` | `string`                  | Current constraint name    |
| `new_constraint_name` | `string`                  | New constraint name        |
