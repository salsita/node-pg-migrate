# Operator Operations

## Operation: `createOperator`

#### `pgm.createOperator( operator_name, options )`

> [!IMPORTANT]
> Create a new operator - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createoperator.html)

### Arguments

| Name            | Type                      | Description                       |
| --------------- | ------------------------- | --------------------------------- |
| `operator_name` | [Name](/migrations/#type) | name of the new operator          |
| `options`       | `object`                  | Check below for available options |

### Options

| Option       | Type                      | Description                            |
| ------------ | ------------------------- | -------------------------------------- |
| `procedure`  | [Name](/migrations/#type) | name of procedure performing operation |
| `left`       | [Name](/migrations/#type) | type of left argument                  |
| `right`      | [Name](/migrations/#type) | type of right argument                 |
| `commutator` | [Name](/migrations/#type) | name of commutative operator           |
| `negator`    | [Name](/migrations/#type) | name of negating operator              |
| `restrict`   | [Name](/migrations/#type) | name of restriction procedure          |
| `join`       | [Name](/migrations/#type) | name of join procedure                 |
| `hashes`     | `boolean`                 | adds `HASHES` clause                   |
| `merges`     | `boolean`                 | adds `MERGES` clause                   |

## Reverse Operation: `dropOperator`

#### `pgm.dropOperator( operator_name, drop_options )`

> [!IMPORTANT]
> Drop an operator - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropoperator.html)

### Arguments

| Name            | Type                      | Description                       |
| --------------- | ------------------------- | --------------------------------- |
| `operator_name` | [Name](/migrations/#type) | name of the operator to drop      |
| `drop_options`  | `object`                  | Check below for available options |

### Options

| Option     | Type                      | Description                    |
| ---------- | ------------------------- | ------------------------------ |
| `ifExists` | `boolean`                 | drops schema only if it exists |
| `cascade`  | `boolean`                 | drops also dependent objects   |
| `left`     | [Name](/migrations/#type) | type of left argument          |
| `right`    | [Name](/migrations/#type) | type of right argument         |

## Operation: `renameOperator`

#### `pgm.createOperatorClass( operator_class_name, type, index_method, operator_list, options )`

> [!IMPORTANT]
> Create a new operator class - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createopclass.html)

### Arguments

| Name                  | Type                      | Description                                       |
| --------------------- | ------------------------- | ------------------------------------------------- |
| `operator_class_name` | [Name](/migrations/#type) | name of the new operator class                    |
| `type`                | `string`                  | data type of the new operator class               |
| `index_method`        | `string`                  | name of the index method of operator class        |
| `operator_list`       | `array`                   | of [operator objects](#operator-list-definitions) |
| `options`             | `object`                  | Check below for available options                 |

### Options

| Option    | Type      | Description           |
| --------- | --------- | --------------------- |
| `default` | `boolean` | adds `DEFAULT` clause |
| `family`  | `string`  | type of left argument |

## Reverse Operation: `dropOperatorClass`

#### `pgm.dropOperatorClass( operator_class_name, index_methoddrop_options )`

> [IMPORTANT]
> Drop a operator class - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropopclass.html)

### Arguments

| Name                  | Type                      | Description                                |
| --------------------- | ------------------------- | ------------------------------------------ |
| `operator_class_name` | [Name](/migrations/#type) | name of the operator class to drop         |
| `index_method`        | `string`                  | name of the index method of operator class |
| `drop_options`        | `object`                  | Check below for available options          |

### Options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | drops schema only if it exists |
| `cascade`  | `boolean` | drops also dependent objects   |

## Operation: `renameOperatorClass`

#### `pgm.renameOperatorClass( old_operator_class_name, index_method, new_operator_class_name )`

> [!IMPORTANT]
> Rename a operator class - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropclass.html)

### Arguments

| Name                      | Type                      | Description                                |
| ------------------------- | ------------------------- | ------------------------------------------ |
| `old_operator_class_name` | [Name](/migrations/#type) | old name of the operator class             |
| `index_method`            | `string`                  | name of the index method of operator class |
| `new_operator_class_name` | [Name](/migrations/#type) | new name of the operator class             |

See [Renaming and schemas](/migrations/#renaming-and-schemas) for schema
normalization, automatic reversal, and supported `PgLiteral` names.
The index access method identifies the operator class and is preserved during
automatic reversal, including when another access method has the same object name.
For both operator rename operations, `index_method` must be a string containing
one unqualified PostgreSQL identifier, such as `'btree'` or `'"Custom.Method"'`.
Accepted text is used as written, without extra quoting or decamelization.

> [!WARNING]
> These two renames now reject missing/non-string access methods, qualified names,
> comments, and other SQL fragments in both directions. Previously valid raw
> forms such as `'btree /* comment */'` must be replaced with a single identifier
> when replaying migrations, or handled with explicit `pgm.sql` in both directions.

```javascript
pgm.renameOperatorClass({ schema: 'app', name: 'old_class' }, 'btree', {
  schema: 'app',
  name: 'new_class',
});
// up:   ALTER OPERATOR CLASS "app"."old_class" USING btree RENAME TO "new_class";
// down: ALTER OPERATOR CLASS "app"."new_class" USING btree RENAME TO "old_class";
```

To move an operator class between schemas, use SQL explicitly, for example
`pgm.sql('ALTER OPERATOR CLASS "old_schema"."my_class" USING btree SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.

## Operation: `alterOperatorClass`

#### `pgm.createOperatorFamily( operator_family_name, index_method )`

> [!IMPORTANT]
> Create a new operator family - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createopfamily.html)

### Arguments

| Name                   | Type                      | Description                                 |
| ---------------------- | ------------------------- | ------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the new operator family             |
| `index_method`         | `string`                  | name of the index method of operator family |

## Reverse Operation: `dropOperatorFamily`

#### `pgm.dropOperatorFamily( operator_family_name, index_methoddrop_options )`

> [!IMPORTANT]
> Drop an operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropopfamily.html)

### Arguments

| Name                   | Type                      | Description                                 |
| ---------------------- | ------------------------- | ------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family to drop         |
| `index_method`         | `string`                  | name of the index method of operator family |
| `drop_options`         | `object`                  | Check below for available options           |

### Options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | drops schema only if it exists |
| `cascade`  | `boolean` | drops also dependent objects   |

## Operation: `renameOperatorFamily`

#### `pgm.renameOperatorFamily( old_operator_family_name, index_method, new_operator_family_name )`

> [!IMPORTANT]
> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

### Arguments

| Name                       | Type                      | Description                                 |
| -------------------------- | ------------------------- | ------------------------------------------- |
| `old_operator_family_name` | [Name](/migrations/#type) | old name of the operator family             |
| `index_method`             | `string`                  | name of the index method of operator family |
| `new_operator_family_name` | [Name](/migrations/#type) | new name of the operator family             |

See [Renaming and schemas](/migrations/#renaming-and-schemas) for schema
normalization, automatic reversal, and supported `PgLiteral` names.
The index access method identifies the operator family and is preserved during
automatic reversal, including when another access method has the same object name.
The same [access-method requirements](#operation-renameoperatorclass) apply here.

```javascript
pgm.renameOperatorFamily({ schema: 'app', name: 'old_family' }, 'btree', {
  schema: 'app',
  name: 'new_family',
});
// up:   ALTER OPERATOR FAMILY "app"."old_family" USING btree RENAME TO "new_family";
// down: ALTER OPERATOR FAMILY "app"."new_family" USING btree RENAME TO "old_family";
```

To move an operator family between schemas, use SQL explicitly, for example
`pgm.sql('ALTER OPERATOR FAMILY "old_schema"."my_family" USING btree SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.

## Operation: `alterOperatorFamily`

#### `pgm.addToOperatorFamily( operator_family_name, index_method, operator_list )`

> [!IMPORTANT]
> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

### Arguments

| Name                   | Type                      | Description                                       |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family                       |
| `index_method`         | `string`                  | name of the index method of operator family       |
| `operator_list`        | `array`                   | of [operator objects](#operator-list-definitions) |

## Reverse Operation: `dropFromOperatorFamily`

#### `pgm.removeFromOperatorFamily( operator_family_name, index_method, operator_list )`

> [!IMPORTANT]
> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

### Arguments

| Name                   | Type                      | Description                                       |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family                       |
| `index_method`         | `string`                  | name of the index method of operator family       |
| `operator_list`        | `array`                   | of [operator objects](#operator-list-definitions) |

## Operator List Definitions

Some functions for defining operators take as parameter `operator_list` which is an array of objects with the following
structure:

| Name     | Type                      | Description                                     |
| -------- | ------------------------- | ----------------------------------------------- |
| `type`   | `string`                  | `function` or `operator`                        |
| `number` | `number`                  | index                                           |
| `name`   | [Name](/migrations/#type) | name of operator or procedure                   |
| `params` | `array`                   | list of argument types of operator or procedure |
