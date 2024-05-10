# Role Operations

## Operation: `createRole`

#### `pgm.createRole( role_name, role_options )`

> [!IMPORTANT]
> Create a new role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createrole.html)

### Arguments

| Name           | Type                      | Description                       |
| -------------- | ------------------------- | --------------------------------- |
| `role_name`    | [Name](/migrations/#type) | name of the new role              |
| `role_options` | `object`                  | Check below for available options |

### role_options

| Option        | Type                        | Description            |
| ------------- | --------------------------- | ---------------------- |
| `superuser`   | `boolean`                   | default `false`        |
| `createdb`    | `boolean`                   | default `false`        |
| `createrole`  | `boolean`                   | default `false`        |
| `inherit`     | `boolean`                   | default `true`         |
| `login`       | `boolean`                   | default `false`        |
| `replication` | `boolean`                   | default `false`        |
| `bypassrls`   | `boolean`                   |                        |
| `limit`       | `number`                    |                        |
| `password`    | `string`                    |                        |
| `encrypted`   | `boolean`                   | default `true`         |
| `valid`       | `string`                    | timestamp              |
| `inRole`      | `string` or `array[string]` | role or array of roles |
| `role`        | `string` or `array[string]` | role or array of roles |
| `admin`       | `string` or `array[string]` | role or array of roles |

## Reverse Operation: `dropRole`

#### `pgm.dropRole( role_name )`

> [!IMPORTANT]
> Drop a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droprole.html)

### Arguments

| Name        | Type                      | Description              |
| ----------- | ------------------------- | ------------------------ |
| `role_name` | [Name](/migrations/#type) | name of the role to drop |

## Operation: `alterRole`

#### `pgm.alterRole( role_name, role_options )`

> [!IMPORTANT]
> Alter a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

### Arguments

| Name           | Type                      | Description          |
| -------------- | ------------------------- | -------------------- |
| `role_name`    | [Name](/migrations/#type) | name of the role     |
| `role_options` | `object`                  | [see](#role_options) |

## Operation: `renameRole`

#### `pgm.renameRole( old_role_name, new_role_name )`

> [!IMPORTANT]
> Rename a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

### Arguments

| Name            | Type                      | Description          |
| --------------- | ------------------------- | -------------------- |
| `old_role_name` | [Name](/migrations/#type) | old name of the role |
| `new_role_name` | [Name](/migrations/#type) | new name of the role |
