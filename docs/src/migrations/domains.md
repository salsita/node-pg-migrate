# Domain Operations

## Operation: `createDomain`

#### `pgm.createDomain( domain_name, type, options )`

> [!IMPORTANT]
> Create a new domain - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createdomain.html)

### Arguments

| Name          | Type                      | Description                       |
| ------------- | ------------------------- | --------------------------------- |
| `domain_name` | [Name](/migrations/#type) | Name of the new domain            |
| `type`        | `string`                  | Type of the new domain            |
| `options`     | `object`                  | Check below for available options |

#### Options

| Option           | Type                               | Description                                                                                                                  |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `default`        | [Value](columns.md#default-values) | Default value of domain. See [Default values](columns.md#default-values)                                                     |
| `collation`      | `string`                           | Collation of data type                                                                                                       |
| `notNull`        | `boolean`                          | Sets NOT NULL if true ([not recommended](https://www.postgresql.org/docs/10/static/sql-createdomain.html#idm46428678330368)) |
| `check`          | `string`                           | SQL for a check constraint for this column                                                                                   |
| `constraintName` | `string`                           | Name for constraint                                                                                                          |

### Reverse Operation: `dropDomain`

#### `pgm.dropDomain( domain_name, drop_options )`

> [!IMPORTANT]
> Drop a domain - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropdomain.html)

### Arguments

| Name           | Type                      | Description                       |
| -------------- | ------------------------- | --------------------------------- |
| `domain_name`  | [Name](/migrations/#type) | Name of the domain to drop        |
| `drop_options` | `object`                  | Check below for available options |

#### Options

| Option     | Type      | Description                    |
| ---------- | --------- | ------------------------------ |
| `ifExists` | `boolean` | Drops domain only if it exists |
| `cascade`  | `boolean` | Drops also dependent objects   |

## Operation: `alterDomain`

#### `pgm.alterDomain( domain_name, type, options )`

> [!IMPORTANT]
> Alter a domain - [postgres docs](https://www.postgresql.org/docs/current/static/sql-alterdomain.html)

### Arguments

| Name          | Type                      | Description                       |
| ------------- | ------------------------- | --------------------------------- |
| `domain_name` | [Name](/migrations/#type) | Name of the new domain            |
| `options`     | `object`                  | Check below for available options |

#### Options

| Option           | Type                               | Description                                                                                              |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `default`        | [Value](columns.md#default-values) | Sets the default. `null` drops it, omitting it keeps it. See [Default values](columns.md#default-values) |
| `collation`      | `string`                           | Collation of data type                                                                                   |
| `notNull`        | `boolean`                          | Sets NOT NULL if true; drops it if false                                                                 |
| `allowNull`      | `boolean`                          | Drops NOT NULL if true; false is ignored and warns unless `notNull: true`                                |
| `check`          | `string`                           | sql for a check constraint for this column                                                               |
| `constraintName` | `string`                           | name for constraint                                                                                      |

Use `notNull: true` to disallow null values, and `notNull: false` or
`allowNull: true` to allow them. Omitting both options leaves nullability unchanged.
`allowNull: false` does not set `NOT NULL` and emits a warning unless
`notNull: true` is also supplied. If both options are `true` or both are `false`,
a warning explains that `notNull` takes precedence: `true` sets `NOT NULL`, and
`false` drops it.

## Operation: `renameDomain`

#### `pgm.renameDomain( old_domain_name, new_domain_name )`

> [!IMPORTANT]
> Rename a domain - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterdomain.html)

### Arguments

| Name              | Type                      | Description            |
| ----------------- | ------------------------- | ---------------------- |
| `old_domain_name` | [Name](/migrations/#type) | Old name of the domain |
| `new_domain_name` | [Name](/migrations/#type) | New name of the domain |

Renaming preserves the source schema, including during automatic reversal. See
[Renaming and schemas](/migrations/#renaming-and-schemas) for destination-schema
validation and supported `PgLiteral` identifiers.

To move a domain between schemas, use SQL explicitly, for example
`pgm.sql('ALTER DOMAIN "old_schema"."my_domain" SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.
