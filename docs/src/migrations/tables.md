# Table Operations

## Operation: `createTable`

#### `pgm.createTable( tablename, columns, options )`

> [!IMPORTANT]
> Create a new table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtable.html)

### Arguments

| Name        | Type                      | Description                                                                               |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `tablename` | [Name](/migrations/#type) | name for the new table                                                                    |
| `columns`   | `object`                  | column names / options -- see [column definitions section](columns.md#column-definitions) |
| `options`   | `object`                  | table options (optional)                                                                  |

### Options

| Option        | Type                                  | Description                                                                                                                   |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `temporary`   | `boolean`                             | default `false`                                                                                                               |
| `ifNotExists` | `boolean`                             | default `false`                                                                                                               |
| `inherits`    | [Name](/migrations/#type)             | table(s) to inherit from                                                                                                      |
| `constraints` | `object`                              | table constraints see `expression` of [add constraint](constraints.md#pgmaddconstraint-tablename-constraint_name-expression-) |
| `like`        | [Name](/migrations/#type) or `object` | table(s) to inherit from or object with `table` and `options` keys                                                            |
| `comment`     | `string`                              | adds comment on table                                                                                                         |
| `unlogged`    | `boolean`                             | default `false`                                                                                                               |
| `partition`   | `object`                              | partition key: `strategy` (`RANGE`, `LIST`, or `HASH`) and `columns` (a column name or array of column names)                 |

#### like options

| Option      | Type                        | Description                                                                                  |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `including` | `string` or `array[string]` | 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL' |
| `excluding` | `string` or `array[string]` | 'COMMENTS', 'CONSTRAINTS', 'DEFAULTS', 'IDENTITY', 'INDEXES', 'STATISTICS', 'STORAGE', 'ALL' |

### Declarative partitioning

`createTable` with `partition` creates the parent table. Create child partitions
before inserting rows; PostgreSQL routes each row to the matching partition.
Partition columns also accept objects with `name`, `collate`, and `opclass`.
Collation and operator class strings are SQL fragments.

```js
pgm.createTable(
  'events',
  { id: 'integer', created_at: 'date' },
  { partition: { strategy: 'RANGE', columns: 'created_at' } }
);
pgm.createPartition('events_2026', 'events', {
  strategy: 'RANGE',
  from: ['2026-01-01'],
  to: ['2027-01-01'],
});
pgm.createPartition('events_other', 'events', { strategy: 'DEFAULT' });
```

## Operation: `createPartition`

#### `pgm.createPartition( tablename, parent, bound, options )`

Creates a child table using [`PARTITION OF`](https://www.postgresql.org/docs/current/sql-createtable.html).
Columns, defaults, constraints, and indexes are inherited from the parent.
Automatic reversal drops the child table using `dropTable`; define the parent
before its children so that automatic rollback drops the children first.

| Name        | Type                      | Description                                                                                                                                             |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tablename` | [Name](/migrations/#type) | name of the new partition                                                                                                                               |
| `parent`    | [Name](/migrations/#type) | existing partitioned parent table                                                                                                                       |
| `bound`     | `object`                  | partition bounds, described below                                                                                                                       |
| `options`   | `object`                  | optional `ifNotExists`, `temporary`, `unlogged`, `comment`, and `partition`, as for `createTable`; `ifExists` and `cascade` apply to automatic reversal |

### Partition bounds

| `strategy` | Other properties                       | Meaning                                                                                  |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `RANGE`    | `from: Value[]`, `to: Value[]`         | inclusive lower bound and exclusive upper bound, with one value per partition key column |
| `LIST`     | `values: Value[]`                      | values assigned to this partition; `null` matches SQL `NULL`                             |
| `HASH`     | `modulus: number`, `remainder: number` | positive integer modulus and integer remainder from zero to modulus minus one            |
| `DEFAULT`  | none                                   | rows not matched by another partition; available for range and list partitioning         |

Range bound lists must be nonempty and have equal lengths. List values must be
nonempty. Values are escaped as SQL values: strings remain string literals.
Use `pgm.func(...)` for explicit SQL expressions, including `MINVALUE` and
`MAXVALUE` in range bounds. PostgreSQL checks that bounds match the parent's
partition strategy and key types and do not overlap existing partitions.

```js
// For parents partitioned by LIST and HASH, respectively:
pgm.createPartition('orders_pending', 'orders', {
  strategy: 'LIST',
  values: ['pending', 'processing'],
});
pgm.createPartition('users_0', 'users', {
  strategy: 'HASH',
  modulus: 2,
  remainder: 0,
});
pgm.createPartition('users_1', 'users', {
  strategy: 'HASH',
  modulus: 2,
  remainder: 1,
});
```

Set `options.partition` to create a partition that is itself partitioned; create
its children with further `createPartition` calls. To attach or detach an
existing table, use `pgm.sql('ALTER TABLE ... ATTACH PARTITION ...')` or
`pgm.sql('ALTER TABLE ... DETACH PARTITION ...')` with an explicit down migration.

## Reverse Operation: `dropTable`

#### `pgm.dropTable( tablename, options )`

> [!IMPORTANT]
> Drop existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptable.html)

### Arguments

| Name        | Type                      | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `tablename` | [Name](/migrations/#type) | name of the table to drop         |
| `options`   | `object`                  | Check below for available options |

### Options

| Option     | Type      | Description                   |
| ---------- | --------- | ----------------------------- |
| `ifExists` | `boolean` | drops table only if it exists |
| `cascade`  | `boolean` | drops also dependent objects  |

## Operation: `renameTable`

#### `pgm.renameTable( tablename, new_tablename )`

> [!IMPORTANT]
> Rename a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)
>
> Reverse Operation: same operation in opposite direction

### Arguments

| Name            | Type                      | Description                 |
| --------------- | ------------------------- | --------------------------- |
| `tablename`     | [Name](/migrations/#type) | name of the table to rename |
| `new_tablename` | [Name](/migrations/#type) | new name of the table       |

Renaming preserves the source schema, including during automatic reversal. See
[Renaming and schemas](/migrations/#renaming-and-schemas) for destination-schema
validation and supported `PgLiteral` identifiers.

To move a table between schemas, use SQL explicitly, for example
`pgm.sql('ALTER TABLE "old_schema"."my_table" SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.

## Operation: `alterTable`

#### `pgm.alterTable( tablename, options )`

> [!IMPORTANT]
> Alter existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

### Arguments

| Name        | Type                      | Description                       |
| ----------- | ------------------------- | --------------------------------- |
| `tablename` | [Name](/migrations/#type) | name of the table to alter        |
| `options`   | `object`                  | Check below for available options |

### Options

| Option          | Type      | Description                                 |
| --------------- | --------- | ------------------------------------------- |
| `levelSecurity` | `string`  | `DISABLE`, `ENABLE`, `FORCE`, or `NO FORCE` |
| `unlogged`      | `boolean` | Sets UNLOGGED if true                       |
