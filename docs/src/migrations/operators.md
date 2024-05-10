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
> Drop a operator - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropoperator.html)

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
| `index_method`        | [Name](/migrations/#type) | name of the index method of operator class        |
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
| `index_method`        | [Name](/migrations/#type) | name of the index method of operator class |
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
| `index_method`            | [Name](/migrations/#type) | name of the index method of operator class |
| `new_operator_class_name` | [Name](/migrations/#type) | new name of the operator class             |

## Operation: `alterOperatorClass`

#### `pgm.createOperatorFamily( operator_family_name, index_method )`

> [!IMPORTANT]
> Create a new operator family - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createopfamily.html)

### Arguments

| Name                   | Type                      | Description                                 |
| ---------------------- | ------------------------- | ------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the new operator family             |
| `index_method`         | [Name](/migrations/#type) | name of the index method of operator family |

## Reverse Operation: `dropOperatorFamily`

#### `pgm.dropOperatorFamily( operator_family_name, index_methoddrop_options )`

> [!IMPORTANT]
> Drop a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropopfamily.html)

### Arguments

| Name                   | Type                      | Description                                 |
| ---------------------- | ------------------------- | ------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family to drop         |
| `index_method`         | [Name](/migrations/#type) | name of the index method of operator family |
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
| `index_method`             | [Name](/migrations/#type) | name of the index method of operator family |
| `new_operator_family_name` | [Name](/migrations/#type) | new name of the operator family             |

## Operation: `alterOperatorFamily`

#### `pgm.addToOperatorFamily( operator_family_name, index_method, operator_list )`

> [!IMPORTANT]
> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

### Arguments

| Name                   | Type                      | Description                                       |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family                       |
| `index_method`         | [Name](/migrations/#type) | name of the index method of operator family       |
| `operator_list`        | `array`                   | of [operator objects](#operator-list-definitions) |

## Reverse Operation: `dropFromOperatorFamily`

#### `pgm.removeFromOperatorFamily( operator_family_name, index_method, operator_list )`

> [!IMPORTANT]
> Rename a operator family - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alteropfamily.html)

### Arguments

| Name                   | Type                      | Description                                       |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| `operator_family_name` | [Name](/migrations/#type) | name of the operator family                       |
| `index_method`         | [Name](/migrations/#type) | name of the index method of operator family       |
| `operator_list`        | `array`                   | of [operator objects](#operator-list-definitions) |

## Operator List Definitions

Some functions for defining operators take as parameter `operator_list` which is array of objects with the following
structure:

| Name     | Type                      | Description                                     |
| -------- | ------------------------- | ----------------------------------------------- |
| `type`   | `string`                  | `function` or `operator`                        |
| `number` | `number`                  | index                                           |
| `name`   | [Name](/migrations/#type) | name of operator or procedure                   |
| `params` | `array`                   | list of argument types of operator or procedure |
