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

Use `{ schema: 'app', name: 'foo' }` to select a schema-qualified table. The
top-level `schema` option is used only with `tables: 'ALL'`; named selections
ignore it. Unqualified names resolve through the connection's `search_path`,
which the runner's `schema` option sets when supplied. The same selection rules
apply to `revokeOnTables` and automatic grant reversal.

## Reverse Operation: `revokeOnTables`

#### `pgm.revokeOnTables( revoke_options )`

> [!IMPORTANT]
> Remove access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

### Arguments

| Name             | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `revoke_options` | `object` | Check below for available options |

#### revoke_options

| Option            | Type                                       | Description                                   |
| ----------------- | ------------------------------------------ | --------------------------------------------- |
| `tables`          | [Name](/migrations/#type) or `array[Name]` | Names of tables                               |
| `schema`          | `string`                                   | if tables ALL, then schema name is required   |
| `privileges`      | `array[TablePrivileges]` or `ALL`          | list of privileges                            |
| `roles`           | [Name](/migrations/#type) or `array[Name]` | names of roles                                |
| `onlyGrantOption` | `boolean`                                  | Revoke only the grant option; default `false` |
| `cascade`         | `boolean`                                  | Revoke dependent grants; default `false`      |

## Operation: `grantOnSequences`

#### `pgm.grantOnSequences( grant_options )`

> [!IMPORTANT]
> Define sequence access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-grant.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `grant_options` | `object` | Check below for available options |

#### grant_options

| Option            | Type                                                      | Description                                                          |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| `sequences`       | [Name](/migrations/#type), `array[Name]`, or `ALL`        | Names of sequences, or all existing sequences in a schema            |
| `schema`          | `string`                                                  | Required when granting on all sequences in a schema                  |
| `privileges`      | `SequencePrivilege`, `array[SequencePrivilege]`, or `ALL` | `SELECT`, `UPDATE`, or `USAGE`; `ALL` grants all sequence privileges |
| `roles`           | [Name](/migrations/#type) or `array[Name]`                | Names of roles; `PUBLIC` grants to all roles                         |
| `withGrantOption` | `boolean`                                                 | Allow recipients to grant privileges to others; default `false`      |
| `onlyGrantOption` | `boolean`                                                 | Revoke only the grant option when reversing; default `false`         |
| `cascade`         | `boolean`                                                 | Revoke dependent grants when reversing; default `false`              |

```ts
pgm.grantOnSequences({
  roles: 'myrole',
  sequences: 'my_table_id_seq',
  privileges: ['SELECT', 'USAGE'],
});

pgm.grantOnSequences({
  roles: 'myrole',
  sequences: 'ALL',
  schema: 'public',
  privileges: 'USAGE',
});
```

Use `{ schema: 'myschema', name: 'my_table_id_seq' }` for a schema-qualified
sequence. `sequences: 'ALL'` together with `schema` affects existing sequences
only; it does not set default privileges for future sequences. Without `schema`,
`'ALL'` is treated as a literal sequence name, as with `grantOnTables`.

The operation reverses automatically with `revokeOnSequences`. A schema-wide
reversal revokes privileges on all sequences present when it runs, including
sequences created after the grant that received privileges independently.

## Reverse Operation: `revokeOnSequences`

#### `pgm.revokeOnSequences( revoke_options )`

> [!IMPORTANT]
> Remove sequence access privileges - [postgres docs](https://www.postgresql.org/docs/current/sql-revoke.html)

### Arguments

| Name             | Type     | Description                       |
| ---------------- | -------- | --------------------------------- |
| `revoke_options` | `object` | Check below for available options |

#### revoke_options

| Option            | Type                                                      | Description                                                                                       |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `sequences`       | [Name](/migrations/#type), `array[Name]`, or `ALL`        | Names of sequences, or all existing sequences in a schema                                         |
| `schema`          | `string`                                                  | Required when revoking on all sequences in a schema                                               |
| `privileges`      | `SequencePrivilege`, `array[SequencePrivilege]`, or `ALL` | `SELECT`, `UPDATE`, or `USAGE`; `ALL` revokes all sequence privileges                             |
| `roles`           | [Name](/migrations/#type) or `array[Name]`                | Names of roles; `PUBLIC` revokes privileges granted to all roles                                  |
| `onlyGrantOption` | `boolean`                                                 | Revoke the ability to grant privileges while retaining the privileges themselves; default `false` |
| `cascade`         | `boolean`                                                 | Revoke dependent grants; default `false`                                                          |

```ts
pgm.revokeOnSequences({
  roles: 'myrole',
  sequences: 'my_table_id_seq',
  privileges: 'USAGE',
});
```

> [!NOTE]
> CockroachDB 23.2.28, 24.3.23, and 25.3.5 support named and schema-wide sequence grants
> and revocations, including grant options, but do not support `CASCADE`. Leave
> `cascade` at its default `false`, including on grants that reverse automatically.
> `ALL` uses the database's full set of sequence privileges, which is broader on
> [CockroachDB](https://www.cockroachlabs.com/docs/v25.3/grant) than on PostgreSQL.

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
