# Type Operations

## Operation: `createType`

### `pgm.createType( type_name, values )`

> [!IMPORTANT]
> Create a new data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtype.html)
> Alias: `addType`

### Arguments

| Name        | Type                        | Description                                                              |
| ----------- | --------------------------- | ------------------------------------------------------------------------ |
| `type_name` | [Name](/migrations/#type)   | name of the new type                                                     |
| `values`    | `array[string]` or `object` | possible values for an enum type or names and types for a composite type |

## Reverse Operation: `dropType`

#### `pgm.dropType( type_name )`

> [!IMPORTANT]
> Drop a custom data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptype.html)

### Arguments

| Name        | Type                      | Description              |
| ----------- | ------------------------- | ------------------------ |
| `type_name` | [Name](/migrations/#type) | name of the type to drop |

## Operation: `alterType`

#### `pgm.renameType( type_name, new_type_name )`

> [!IMPORTANT]
> Rename a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name            | Type                      | Description                |
| --------------- | ------------------------- | -------------------------- |
| `type_name`     | [Name](/migrations/#type) | name of the type to rename |
| `new_type_name` | [Name](/migrations/#type) | name of the new type       |

## Operation: `alterType`

#### `pgm.addTypeAttribute( type_name, attribute_name, attribute_type )`

> [!IMPORTANT]
> Add attribute to an existing data
> type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name             | Type                      | Description                  |
| ---------------- | ------------------------- | ---------------------------- |
| `type_name`      | [Name](/migrations/#type) | name of the type             |
| `attribute_name` | `string`                  | name of the attribute to add |
| `attribute_type` | `string`                  | type of the attribute to add |

## Reverse Operation: `dropTypeAttribute`

#### `pgm.dropTypeAttribute( type_name, attribute_name, options )`

> [!IMPORTANT]
> Drop attribute from a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name             | Type                      | Description                       |
| ---------------- | ------------------------- | --------------------------------- |
| `type_name`      | [Name](/migrations/#type) | name of the type                  |
| `attribute_name` | `string`                  | name of the attribute to drop     |
| `options`        | `object`                  | Check below for available options |

### Options

| Option     | Type      | Description                       |
| ---------- | --------- | --------------------------------- |
| `ifExists` | `boolean` | drops attribute only if it exists |

## Operation: `alterType`

#### `pgm.setTypeAttribute( type_name, attribute_name, attribute_type )`

> [!IMPORTANT]
> Set data type of an existing data attribute
> type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name             | Type                      | Description                  |
| ---------------- | ------------------------- | ---------------------------- |
| `type_name`      | [Name](/migrations/#type) | name of the type             |
| `attribute_name` | `string`                  | name of the attribute to set |
| `attribute_type` | `string`                  | new type of the attribute    |

## Operation: `alterType`

#### `pgm.addTypeValue( type_name, value, options )`

> [!IMPORTANT]
> Add value to a list of enum data
> type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name        | Type                      | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `type_name` | [Name](/migrations/#type) | name of the type                  |
| `value`     | `string`                  | value to add to list              |
| `options`   | `object`                  | Check below for available options |

### Options

| Option        | Type      | Description                                    |
| ------------- | --------- | ---------------------------------------------- |
| `ifNotExists` | `boolean` | default false                                  |
| `before`      | `string`  | value before which the new value should be add |
| `after`       | `string`  | value after which the new value should be add  |

## Reverse Operation: `dropTypeValue`

#### `pgm.renameTypeAttribute( type_name, attribute_name, new_attribute_name )`

> [!IMPORTANT]
> Rename an attribute of data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name                 | Type                      | Description                     |
| -------------------- | ------------------------- | ------------------------------- |
| `type_name`          | [Name](/migrations/#type) | name of the type                |
| `attribute_name`     | `string`                  | name of the attribute to rename |
| `new_attribute_name` | `string`                  | new name of the attribute       |

## Operation: `alterType`

#### `pgm.renameTypeValue( type_name, value, new_value )`

> [!IMPORTANT]
> Rename a value of enum data type - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altertype.html)

### Arguments

| Name        | Type                      | Description      |
| ----------- | ------------------------- | ---------------- |
| `type_name` | [Name](/migrations/#type) | name of the type |
| `value`     | `string`                  | value to rename  |
| `new_value` | `string`                  | new value        |
