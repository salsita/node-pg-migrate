# Materialized View Operations

## Operation: `createMaterializedView`

#### `pgm.createMaterializedView( viewName, options, definition )`

> [!IMPORTANT]
> Create a new materialized
> view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-creatematerializedview.html)

### Arguments

| Name         | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `viewName`   | `string` | name of the new materialized view |
| `options`    | `object` | Check below for available options |
| `definition` | `string` | SQL of SELECT statement           |

### Options

| Option              | Type                | Description                                                                                                                                              |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ifNotExists`       | `boolean`           | adds `IF NOT EXISTS` clause                                                                                                                              |
| `columns`           | `string` or `array` | use if you want to name columns differently then inferred from definition                                                                                |
| `tablespace`        | `string`            | optional                                                                                                                                                 |
| `storageParameters` | `object`            | optional key value pairs of [Storage Parameters](https://www.postgresql.org/docs/current/static/sql-createtable.html#SQL-CREATETABLE-STORAGE-PARAMETERS) |
| `data`              | `boolean`           | default `undefined`                                                                                                                                      |

## Reverse Operation: `dropMaterializedView`

#### `pgm.dropMaterializedView( viewName, options )`

> [!IMPORTANT]
> Drop a materialized
> view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropmaterializedview.html)

### Arguments

| Name       | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `viewName` | `string` | name of the view to delete        |
| `options`  | `object` | Check below for available options |

### Options

| Option     | Type      | Description                  |
| ---------- | --------- | ---------------------------- |
| `ifExists` | `boolean` | drops view only if it exists |
| `cascade`  | `boolean` | drops also dependent objects |

## Operation: `alterMaterializedView`

#### `pgm.alterMaterializedView( viewName, options )`

> [!IMPORTANT]
> Alter a materialized
> view - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

### Arguments

| Name       | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `viewName` | `string` | name of the view to alter         |
| `options`  | `object` | Check below for available options |

### Options

| Option              | Type     | Description                                                                                                                                                                |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cluster`           | `string` | optional index name for clustering                                                                                                                                         |
| `extension`         | `string` | optional name of extension view is dependent on                                                                                                                            |
| `storageParameters` | `object` | optional key value (`null` to reset) pairs of [Storage Parameters](https://www.postgresql.org/docs/current/static/sql-createtable.html#SQL-CREATETABLE-STORAGE-PARAMETERS) |

## Operation: `renameMaterializedView`

#### `pgm.renameMaterializedView( viewName, newViewName )`

> [!IMPORTANT]
> Rename a materialized
> view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

### Arguments

| Name          | Type     | Description          |
| ------------- | -------- | -------------------- |
| `viewName`    | `string` | old name of the view |
| `newViewName` | `string` | new name of the view |

## Operation: `alterMaterializedViewColumn`

#### `pgm.renameMaterializedViewColumn( viewName, columnName, newColumnName )`

> [!IMPORTANT]
> Rename a materialized view
> column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altermaterializedview.html)

### Arguments

| Name            | Type     | Description               |
| --------------- | -------- | ------------------------- |
| `viewName`      | `string` | name of the view to alter |
| `columnName`    | `string` | current column name       |
| `newColumnName` | `string` | new column name           |

## Operation: `refreshMaterializedView`

#### `pgm.refreshMaterializedView( viewName, options )`

> [!IMPORTANT]
> Refreshes a materialized
> view - [postgres docs](http://www.postgresql.org/docs/current/static/sql-refreshmaterializedview.html)

### Arguments

| Name       | Type     | Description                                      |
| ---------- | -------- | ------------------------------------------------ |
| `viewName` | `string` | [Name](/migrations/#type) of the view to refresh |
| `options`  | `object` | Check below for available options                |

### Options

| Option         | Type      | Description         |
| -------------- | --------- | ------------------- |
| `concurrently` | `boolean` | default `false`     |
| `data`         | `boolean` | default `undefined` |
