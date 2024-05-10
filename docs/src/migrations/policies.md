# Policies Operations

## Operation: `createPolicy`

#### `pgm.createPolicy( tableName, policyName, options )`

> [!IMPORTANT]
> Create a new policy - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createpolicy.html)

### Arguments

| Name         | Type                      | Description                       |
| ------------ | ------------------------- | --------------------------------- |
| `tableName`  | [Name](/migrations/#type) | name of the table to alter        |
| `policyName` | `string`                  | name of the new policy            |
| `options`    | `object`                  | Check below for available options |

#### Options

| Option    | Type                | Description                                        |
| --------- | ------------------- | -------------------------------------------------- |
| `command` | `string`            | `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`   |
| `role`    | `string` or `array` | the role(s) to which the policy is to be applied   |
| `using`   | `string`            | SQL conditional expression for visibility check    |
| `check`   | `string`            | SQL conditional expression for insert/update check |

## Reverse Operation: `dropPolicy`

#### `pgm.dropPolicy( tableName, policyName, options )`

> [!IMPORTANT]
> Drop a policy - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droppolicy.html)

### Arguments

| Name         | Type                      | Description                           |
| ------------ | ------------------------- | ------------------------------------- |
| `tableName`  | [Name](/migrations/#type) | name of the table where the policy is |
| `policyName` | `string`                  | name of the policy to delete          |
| `options`    | `object`                  | Check below for available options     |

#### Options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | drops policy only if it exists |

## Operation: `alterPolicy`

#### `pgm.alterPolicy( tableName, policyName, options )`

> [!IMPORTANT]
> Alter a policy - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterpolicy.html)

### Arguments

| Name         | Type                      | Description                           |
| ------------ | ------------------------- | ------------------------------------- |
| `tableName`  | [Name](/migrations/#type) | name of the table where the policy is |
| `policyName` | `string`                  | name of the policy to alter           |
| `options`    | `object`                  | Check below for available options     |

#### Options

| Option  | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| `role`  | `string` | the role(s) to which the policy is to be applied   |
| `using` | `string` | SQL conditional expression for visibility check    |
| `check` | `string` | SQL conditional expression for insert/update check |

## Operation: `renamePolicy`

#### `pgm.renamePolicy( tableName, policyName, newPolicyName )`

> [!IMPORTANT]
> Rename a policy - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterpolicy.html)

### Arguments

| Name            | Type                      | Description                           |
| --------------- | ------------------------- | ------------------------------------- |
| `tableName`     | [Name](/migrations/#type) | name of the table where the policy is |
| `policyName`    | `string`                  | old name of the policy                |
| `newPolicyName` | `string`                  | new name of the policy                |
