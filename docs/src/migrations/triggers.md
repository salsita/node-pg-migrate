# Trigger Operations

## Operation: `createTrigger`

#### `pgm.createTrigger( table_name, trigger_name, trigger_options )`

> [!IMPORTANT]
> Create a new trigger - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createtrigger.html)

### Arguments

| Name              | Type                      | Description                                                                     |
|-------------------|---------------------------|---------------------------------------------------------------------------------|
| `table_name`      | [Name](/migrations/#type) | Name of the table where the new trigger will live                               |
| `trigger_name`    | `string`                  | Name of the new trigger                                                         |
| `trigger_options` | `object`                  | Check below for available options                                               |
| `definition`      | `string`                  | Optional definition of function which will be created with same name as trigger |

#### Trigger Options:

| Option           | Type                      | Description                                               |
|------------------|---------------------------|-----------------------------------------------------------|
| `when`           | `string`                  | `BEFORE`, `AFTER`, or `INSTEAD OF`                        |
| `operation`      | `string or array[string]` | `INSERT`, `UPDATE[ OF ...]`, `DELETE` or `TRUNCATE`       |
| `constraint`     | `boolean`                 | Creates constraint trigger                                |
| `function`       | [Name](/migrations/#type) | The name of procedure to execute                          |
| `functionParams` | `array`                   | Parameters of the procedure                               |
| `level`          | `string`                  | `STATEMENT`, or `ROW`                                     |
| `condition`      | `string`                  | Condition to met to execute trigger                       |
| `deferrable`     | `boolean`                 | Flag for deferrable constraint trigger                    |
| `deferred`       | `boolean`                 | Flag for initially deferred deferrable constraint trigger |

## Reverse Operation: `dropTrigger`

#### `pgm.dropTrigger( table_name, trigger_name, drop_options )`

> Drop a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptrigger.html)

### Arguments

| Name            | Type                      | Description                                                                 |
|-----------------|---------------------------|-----------------------------------------------------------------------------|
| `table_name`    | [Name](/migrations/#type) | Name of the table where the trigger lives                                   |
| `trigger_name`  | `string`                  | Name of the trigger to drop                                                 |
| `drop_options`  | `object`                  | Check below for available options                                           |

#### Drop Options:

| Option     | Type      | Description                                      |
|------------|-----------|--------------------------------------------------|
| `ifExists` | `boolean` | Drops trigger only if it exists                  |
| `cascade`  | `boolean` | Drops also dependent objects                     |

## Operation: `renameTrigger`

#### `pgm.renameTrigger( table_name, old_trigger_name, new_trigger_name )`

>[!IMPORTANT]
> Rename a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertrigger.html)

### Arguments

| Name               | Type                      | Description                               |
|--------------------|---------------------------|-------------------------------------------|
| `table_name`       | [Name](/migrations/#type) | Name of the table where the trigger lives |
| `old_trigger_name` | `string`                  | Old name of the trigger                   |
| `new_trigger_name` | `string`                  | New name of the trigger                   |
