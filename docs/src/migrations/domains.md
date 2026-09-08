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

| Option           | Type      | Description                                                                                                                  |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `default`        | `string`  | Default value of domain                                                                                                      |
| `collation`      | `string`  | Collation of data type                                                                                                       |
| `notNull`        | `boolean` | Sets NOT NULL if true ([not recommended](https://www.postgresql.org/docs/10/static/sql-createdomain.html#idm46428678330368)) |
| `check`          | `string`  | SQL for a check constraint for this column                                                                                   |
| `constraintName` | `string`  | Name for constraint                                                                                                          |

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

| Option           | Type      | Description                                  |
| ---------------- | --------- | -------------------------------------------- |
| `default`        | `string`  | Default value of domain                      |
| `collation`      | `string`  | Collation of data type                       |
| `notNull`        | `boolean` | sets NOT NULL if true or NULL if false       |
| `allowNull`      | `boolean` | sets NULL if true (alternative to `notNull`) |
| `check`          | `string`  | sql for a check constraint for this column   |
| `constraintName` | `string`  | name for constraint                          |

## Operation: `renameDomain`

#### `pgm.renameDomain( old_domain_name, new_domain_name )`

> [!IMPORTANT]
> Rename a domain - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterdomain.html)

### Arguments

| Name              | Type                      | Description            |
| ----------------- | ------------------------- | ---------------------- |
| `old_domain_name` | [Name](/migrations/#type) | Old name of the domain |
| `new_domain_name` | [Name](/migrations/#type) | New name of the domain |

The destination name is unqualified in the generated SQL. If a destination object
specifies a schema, it must match the source schema. Use `{ schema, name }` for
schema-qualified names so automatic reversal preserves the source schema;
the schema cannot be inferred from a string name or the database search path.

Qualified `PgLiteral` names can produce invalid SQL, including during automatic
reversal. Use structured name objects instead, or use `pgm.sql` with explicit SQL
in both your up and down migrations.

To move a domain between schemas, use SQL explicitly, for example
`pgm.sql('ALTER DOMAIN "old_schema"."my_domain" SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.
