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
