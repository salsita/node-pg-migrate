# Schema Operations

## Operation: `createSchema`

#### `pgm.createSchema( schema_name, schema_options )`

> [!IMPORTANT]
> Create a new schema - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createschema.html)

### Arguments

| Name             | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `schema_name`    | `string` | name of the new schema            |
| `schema_options` | `object` | Check below for available options |

### schema_options

| Option          | Type      | Description                        |
| --------------- | --------- | ---------------------------------- |
| `ifNotExists`   | `boolean` | adds `IF NOT EXISTS` clause        |
| `authorization` | `string`  | alternative user to own new schema |

## Reverse Operation: `dropSchema`

#### `pgm.dropSchema( schema_name, drop_options )`

> [!IMPORTANT]
> Drop a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropschema.html)

### Arguments

| Name           | Type     | Description                       |
| -------------- | -------- | --------------------------------- |
| `schema_name`  | `string` | name of the schema to drop        |
| `drop_options` | `object` | Check below for available options |

### drop_options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | drops schema only if it exists |
| `cascade`  | `boolean` | drops also dependent objects   |

## Operation: `alterSchema`

#### `pgm.renameSchema( old_schema_name, new_schema_name )`

> [!IMPORTANT]
> Rename a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterschema.html)

### Arguments

| Name              | Type     | Description            |
| ----------------- | -------- | ---------------------- |
| `old_schema_name` | `string` | old name of the schema |
| `new_schema_name` | `string` | new name of the schema |
