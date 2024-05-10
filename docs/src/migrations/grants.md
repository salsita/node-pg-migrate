# Grant Operations

## Operation: `grantRoles`

#### `pgm.grantRoles( roles_from, roles_to, grant_roles_options )`

> [!IMPORTANT]
> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

### Arguments

| Name                  | Type                                       | Description                       |
| --------------------- | ------------------------------------------ | --------------------------------- |
| `roles_from`          | [Name](/migrations/#type) or `array[Name]` | Names of roles                    |
| `roles_to`            | [Name](/migrations/#type) or `array[Name]` | Names of roles                    |
| `grant_roles_options` | `object`                                   | Check below for available options |

#### grant_roles_options

| Option            | Type      | Default |
| ----------------- | --------- | ------- |
| `withAdminOption` | `boolean` | `false` |
| `onlyAdminOption` | `boolean` | `false` |
| `cascade`         | `boolean` | `false` |

## Reverse Operation: `revokeRoles`

#### `pgm.revokeRoles( roles, roles_from, drop_options )`

> [!IMPORTANT]
> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

### Arguments

| Name           | Type                                       | Description                       |
| -------------- | ------------------------------------------ | --------------------------------- |
| `roles`        | [Name](/migrations/#type) or `array[Name]` | Names of roles                    |
| `roles_from`   | [Name](/migrations/#type) or `array[Name]` | Names of roles                    |
| `drop_options` | `object`                                   | Check below for available options |

#### drop_options

| Option            | Type      | Description                  |
| ----------------- | --------- | ---------------------------- |
| `onlyAdminOption` | `boolean` | default `false`              |
| `cascade`         | `boolean` | drops also dependent objects |

## Operation: `grantOnTables`

#### `pgm.grantOnTables( grant_options )`

> [!IMPORTANT]
> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `grant_options` | `object` | Check below for available options |

#### grant_options

| Option            | Type                                       | Description                                 |
| ----------------- | ------------------------------------------ | ------------------------------------------- |
| `tables`          | [Name](/migrations/#type) or `array[Name]` | Names of tables                             |
| `schema`          | `string`                                   | if tables ALL, then schema name is required |
| `privileges`      | `array[TablePrivileges]` or `ALL`          | list of privileges                          |
| `roles`           | [Name](/migrations/#type) or `array[Name]` | names of roles                              |
| `withGrantOption` | `boolean`                                  | default `false`                             |
| `cascade`         | `boolean`                                  | default `false`                             |

## Reverse Operation: `revokeOnTables`

#### `pgm.revokeOnTables( revoke_options )`

> [!IMPORTANT]
> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

### Arguments

| Name             | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `revoke_options` | `object` | Check below for available options |

#### revoke_options

| Option            | Type                                       | Description                                 |
| ----------------- | ------------------------------------------ | ------------------------------------------- |
| `tables`          | [Name](/migrations/#type) or `array[Name]` | Names of tables                             |
| `schema`          | `string`                                   | if tables ALL, then schema name is required |
| `privileges`      | `array[TablePrivileges]` or `ALL`          | list of privileges                          |
| `roles`           | [Name](/migrations/#type) or `array[Name]` | names of roles                              |
| `withGrantOption` | `boolean`                                  | default `false`                             |
| `cascade`         | `boolean`                                  | drops also dependent objects                |

## Operation: `grantOnSchemas`

#### `pgm.grantOnSchemas( grant_options )`

> [!IMPORTANT]
> Define access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `grant_options` | `object` | Check below for available options |

#### grant_options

| Option            | Type                                       | Description        |
| ----------------- | ------------------------------------------ | ------------------ |
| `schemas`         | [Name](/migrations/#type) or `array[Name]` | Names of schemas   |
| `privileges`      | `array[SchemaPrivileges]` or `ALL`         | list of privileges |
| `roles`           | [Name](/migrations/#type) or `array[Name]` | names of roles     |
| `withGrantOption` | `boolean`                                  | default `false`    |
| `onlyGrantOption` | `boolean`                                  | default `false`    |
| `cascade`         | `boolean`                                  | default `false`    |

## Reverse Operation: `revokeOnSchemas`

#### `pgm.revokeOnSchemas( revoke_options )`

> [!IMPORTANT]
> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

### Arguments

| Name             | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `revoke_options` | `object` | Check below for available options |

#### revoke_options

| Option            | Type                                       | Description                  |
| ----------------- | ------------------------------------------ | ---------------------------- |
| `schemas`         | [Name](/migrations/#type) or `array[Name]` | Names of schemas             |
| `privileges`      | `array[SchemaPrivileges]` or `ALL`         | list of privileges           |
| `roles`           | [Name](/migrations/#type) or `array[Name]` | names of roles               |
| `withGrantOption` | `boolean`                                  | default `false`              |
| `onlyGrantOption` | `boolean`                                  | default `false`              |
| `cascade`         | `boolean`                                  | drops also dependent objects |
