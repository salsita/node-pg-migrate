# Trigger Operations

## Operation: `createTrigger`

#### `pgm.createTrigger( table_name, trigger_name, trigger_options )`

> [!IMPORTANT]
> Create a new trigger - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createtrigger.html)

### Arguments

| Name              | Type                      | Description                                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `table_name`      | [Name](/migrations/#type) | Name of the table where the new trigger will live                               |
| `trigger_name`    | `string`                  | Name of the new trigger                                                         |
| `trigger_options` | `object`                  | Check below for available options                                               |
| `definition`      | `string`                  | Optional definition of function which will be created with same name as trigger |

#### Trigger Options:

| Option           | Type                      | Description                                               |
| ---------------- | ------------------------- | --------------------------------------------------------- |
| `when`           | `string`                  | `BEFORE`, `AFTER`, or `INSTEAD OF`                        |
| `operation`      | `string or array[string]` | `INSERT`, `UPDATE[ OF ...]`, `DELETE` or `TRUNCATE`       |
| `updateOf`       | `string or array[string]` | Columns restricting the `UPDATE` event; see below         |
| `constraint`     | `boolean`                 | Creates constraint trigger                                |
| `function`       | [Name](/migrations/#type) | The name of procedure to execute                          |
| `functionParams` | `array`                   | Parameters of the procedure                               |
| `level`          | `string`                  | `STATEMENT`, or `ROW`                                     |
| `condition`      | `string`                  | Condition to met to execute trigger                       |
| `deferrable`     | `boolean`                 | Flag for deferrable constraint trigger                    |
| `deferred`       | `boolean`                 | Flag for initially deferred deferrable constraint trigger |

### Column-specific UPDATE triggers

Use `updateOf` with an `UPDATE` event to fire a trigger only when an update targets
one of the listed columns. Pass column names without SQL quoting; identifiers
such as `CamelCaseColumn`, `order`, or `first-name` are quoted automatically, and
the `decamelize` option applies to them.

```js
pgm.createTrigger('accounts', 'accounts_sync', {
  when: 'AFTER',
  operation: ['INSERT', 'UPDATE'],
  updateOf: ['CamelCaseColumn', 'order'],
  level: 'ROW',
  function: 'sync_account',
});
```

This generates `AFTER INSERT OR UPDATE OF "CamelCaseColumn", "order"`. A single
column can be passed as a string, for example `updateOf: 'name'`. An omitted
option or an empty array leaves the events unchanged. An update targeting a
listed column fires the trigger even if the column's value does not change.

A nonempty `updateOf` requires a standalone `UPDATE` event in `operation`
(case-insensitive). Column names must not be empty strings. For multiple events,
use an array as above. It cannot be combined with an existing `UPDATE OF` event
or an `INSTEAD OF` trigger.

[CockroachDB 24.3+ does not support column-specific UPDATE triggers](https://www.cockroachlabs.com/docs/stable/triggers#known-limitations).

Existing SQL strings such as `operation: 'UPDATE OF "CamelCaseColumn"'` remain
supported and are passed through unchanged, without automatic quoting or
decamelization.

## Reverse Operation: `dropTrigger`

#### `pgm.dropTrigger( table_name, trigger_name, drop_options )`

> [!IMPORTANT]
> Drop a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptrigger.html)

### Arguments

| Name           | Type                      | Description                               |
| -------------- | ------------------------- | ----------------------------------------- |
| `table_name`   | [Name](/migrations/#type) | Name of the table where the trigger lives |
| `trigger_name` | `string`                  | Name of the trigger to drop               |
| `drop_options` | `object`                  | Check below for available options         |

#### Drop Options:

| Option     | Type      | Description                     |
| ---------- | --------- | ------------------------------- |
| `ifExists` | `boolean` | Drops trigger only if it exists |
| `cascade`  | `boolean` | Drops also dependent objects    |

## Operation: `renameTrigger`

#### `pgm.renameTrigger( table_name, old_trigger_name, new_trigger_name )`

> [!IMPORTANT]
> Rename a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertrigger.html)

### Arguments

| Name               | Type                      | Description                               |
| ------------------ | ------------------------- | ----------------------------------------- |
| `table_name`       | [Name](/migrations/#type) | Name of the table where the trigger lives |
| `old_trigger_name` | `string`                  | Old name of the trigger                   |
| `new_trigger_name` | `string`                  | New name of the trigger                   |
