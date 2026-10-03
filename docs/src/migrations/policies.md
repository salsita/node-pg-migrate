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
| `as`      | `string`            | `PERMISSIVE` (default) or `RESTRICTIVE`            |
| `command` | `string`            | `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`   |
| `role`    | `string` or `array` | the role(s) to which the policy is to be applied   |
| `using`   | `string`            | SQL conditional expression for visibility check    |
| `check`   | `string`            | SQL conditional expression for insert/update check |

Permissive policies combine with `OR`; restrictive policies combine with `AND`.
At least one permissive policy must grant access for restrictive policies to
allow any rows. Omitting `as` preserves PostgreSQL's default permissive behavior.

```js
pgm.createPolicy('accounts', 'active_accounts', {
  as: 'RESTRICTIVE',
  command: 'SELECT',
  using: 'active = true',
});
```

The policy mode can only be set by `createPolicy`. To change it, drop and recreate
the policy; `alterPolicy` cannot change whether a policy is permissive or
restrictive.

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
