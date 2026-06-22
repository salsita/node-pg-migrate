# Index Operations

## Operation: `createIndex`

#### `pgm.createIndex( tablename, columns, options )`

> [!IMPORTANT]
> Create a new index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createindex.html)
> Alias: `addIndex`

### Arguments

| Name        | Type                        | Description                                                       |
| ----------- | --------------------------- | ----------------------------------------------------------------- |
| `tablename` | [Name](/migrations/#type)   | name of the table to alter                                        |
| `columns`   | `string` or `array[string]` | columns to add to the index with optional operator class and sort |
| `options`   | `object`                    | Check below for available options                                 |

#### Options

| Option         | Type                        | Description                                                               |
| -------------- | --------------------------- | ------------------------------------------------------------------------- |
| `name`         | `string`                    | name for the index (one will be inferred from table/columns if undefined) |
| `unique`       | `boolean`                   | set to true if this is a unique index                                     |
| `where`        | `string`                    | raw sql for where clause of index                                         |
| `concurrently` | `boolean`                   | create this index concurrently                                            |
| `ifNotExists`  | `boolean`                   | default false                                                             |
| `method`       | `string`                    | btree \| hash \| gist \| spgist \| gin                                    |
| `include`      | `string` or `array[string]` | columns to add to the include clause                                      |
| `nulls`        | `string`                    | distinct \| not distinct (for unique indexes only)                        |

### Examples

::: code-group

```ts [single column]
pgm.createIndex('table', 'column');
//expected output: CREATE INDEX ON "table" ("column")
```

```ts [multiple columns]
pgm.createIndex('table', ['col1', 'col2']);
//expected output: CREATE INDEX ON "table" ("col1", "col2")
```

```ts [multiple columns with options]
pgm.createIndex('table', [
  { name: 'col1', sort: 'ASC' },
  { name: 'col2', sort: 'DESC' },
]);
//expected output: CREATE INDEX ON "table" ("col1" ASC, "col2" DESC)
```

```ts [operator class]
pgm.createIndex('table', [
  { name: 'col1', opclass: { schema: 'schema', name: 'opclass' }, sort: 'ASC' },
]);
//expected output: CREATE INDEX ON "table" ("col1" "schema"."opclass" ASC)
```

:::

## Reverse Operation: `dropIndex`

#### `pgm.dropIndex( tablename, columns, options )`

> [!IMPORTANT]
> Drop an index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropindex.html)

### Arguments

| Name        | Type                        | Description                                    |
| ----------- | --------------------------- | ---------------------------------------------- |
| `tablename` | [Name](/migrations/#type)   | name of the table to alter                     |
| `columns`   | `string` or `array[string]` | column names, used only to infer an index name |
| `options`   | `object`                    | Check below for available options              |

#### Options

| Option         | Type      | Description                  |
| -------------- | --------- | ---------------------------- |
| `name`         | `string`  | name of the index to drop    |
| `concurrently` | `boolean` | drop this index concurrently |
| `ifExists`     | `boolean` | default false                |
| `cascade`      | `boolean` | default false                |

:::

## Operation: `renameIndex`

#### `pgm.renameIndex( name, newName )`

> [!IMPORTANT]
> Rename an index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterindex.html)

### Arguments

| Name      | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `name`    | `string` | name of the index to rename |
| `newName` | `string` | new name for the index      |

### Examples

::: code-group

```ts [single column]
pgm.renameIndex('index_name', 'new_index_name');
//expected output: ALTER INDEX index_name RENAME TO new_index_name;
```

## Operation: `alterIndex`

#### `pgm.alterIndex( name, newName, options )`

> [!IMPORTANT]
> Alter an index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterindex.html)

### Arguments

| Name      | Type               | Description                       |
| --------- | ------------------ | --------------------------------- |
| `name`    | `string`           | name of the index to rename       |
| `newName` | `string` or `null` | new name for the param            |
| `options` | `object`           | Check below for available options |

#### Options

| Option        | Type                                  | Description                                     | Default Value |
| ------------- | ------------------------------------- | ----------------------------------------------- | ------------- |
| `clause`      | [AlterIndexAction](/migrations/#type) | action to perform on the index                  | `set-table`   |
| `ifExists`    | `boolean`                             | adds `IF EXISTS` clause                         | `false`       |
| `no`          | `boolean`                             | adds `NO` clause to the action                  | `false`       |
| `columNumber` | `number`                              | column number for the index                     | `null`        |
| `colum`       | `boolean`                             | column index to alter                           | `null`        |
| `integer`     | `number`                              | integer value for the index                     | `null`        |
| `ownedBy`     | `string` or `array[string]`           | sets the table and column the index is owned by | `null`        |
| `noWait`      | `boolean`                             | adds `NOWAIT` clause                            | `false`       |

### Examples

::: code-group

```ts [single column]
pgm.alterIndex('name', 'tablespace_name'); // has ifExists option
//expected output: ALTER INDEX name SET TABLESPACE tablespace_name;
```

```ts [single column]
pgm.alterIndex('name', 'tablespace_name', { clause: 'set-table' }); // has ifExists option
//expected output: ALTER INDEX name SET TABLESPACE tablespace_name;
```

```ts [single column]
pgm.alterIndex('name', 'index_name', { clause: 'attach-partition' });
//expected output: ALTER INDEX name ATTACH PARTITION index_name;
```

```ts [single column]
pgm.alterIndex('name', 'extension_name', {
  clause: 'extension',
  no: true,
});
//expected output: ALTER INDEX name NO DEPENDS ON EXTENSION extension_name;
```

```ts [single column]
pgm.alterIndex('index_name', null, {
  clause: 'alter',
  colum: true,
  columNumber: 23,
  integer: 100,
}); // has ifExists option
//expected output: ALTER INDEX index_name ALTER COLUMN 23 SET STATISTICS 100;
```

```ts [single column]
pgm.alterIndex('index_name', 'new_tablespace', {
  clause: 'all',
  ownedBy: ['app_user', 'admin_user'],
  noWait: true,
});
//expected output: ALTER INDEX ALL IN TABLESPACE index_name OWNED BY app_user, admin_user SET TABLESPACE new_tablespace NOWAIT;
```
