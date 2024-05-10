# Sequence Operations

## Sequence Options

The `createSequence` and `alterSequence` methods both take an `options` argument that specifies parameters of a
sequence.

| Option      | Type                          | Description                                                                 |
| ----------- | ----------------------------- | --------------------------------------------------------------------------- |
| `type`      | `string`                      | type of the sequence                                                        |
| `increment` | `number`                      | sets first value of sequence                                                |
| `minvalue`  | `number` or `null` or `false` | sets minimum value of sequence or `NO MINVALUE` (if value is false or null) |
| `maxvalue`  | `number` or `null` or `false` | sets maximum value of sequence or `NO MAXVALUE` (if value is false or null) |
| `start`     | `number`                      | sets first value of sequence                                                |
| `cache`     | `number`                      | sets how many sequence numbers should be pre-allocated                      |
| `cycle`     | `boolean`                     | adds `CYCLE` or `NO CYCLE` clause if option is present                      |
| `owner`     | `string` or `null` or `false` | sets owner of sequence or no owner (if value is false or null)              |

## Operation: `createSequence`

#### `pgm.createSequence( sequence_name, options )`

> [!IMPORTANT]
> Create a new sequence - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createsequence.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `sequence_name` | `string` | name of the new sequence          |
| `options`       | `object` | Check below for available options |

### Options

| Option           | Type      | Description                                       |
| ---------------- | --------- | ------------------------------------------------- |
| `temporary`      | `boolean` | adds `TEMPORARY` clause                           |
| `ifNotExists`    | `boolean` | adds `IF NOT EXISTS` clause                       |
| sequence options | `object`  | see [sequence options section](#sequence-options) |

### Reverse Operation: `dropSequence`

#### `pgm.dropSequence( sequence_name, drop_options )`

> [!IMPORTANT]
> Drop a sequence - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropsequence.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `sequence_name` | `string` | name of the sequence to drop      |
| `drop_options`  | `object` | Check below for available options |

### Options

| Option     | Type      | Description                      |
| ---------- | --------- | -------------------------------- |
| `ifExists` | `boolean` | drops sequence only if it exists |
| `cascade`  | `boolean` | drops also dependent objects     |

## Operation: `alterSequence`

#### `pgm.alterSequence( sequence_name, options )`

> [!IMPORTANT]
> Alter a sequence - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altersequence.html)

### Arguments

| Name            | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `sequence_name` | `string` | name of the sequence to alter     |
| `options`       | `object` | Check below for available options |

### Options

| Option           | Type               | Description                                                         |
| ---------------- | ------------------ | ------------------------------------------------------------------- |
| `restart`        | `number` or `true` | sets first value of sequence or using `start` value (on true value) |
| sequence options | `object`           | see [sequence options section](#sequence-options)                   |

## Reverse Operation: `renameSequence`

#### `pgm.renameSequence( old_sequence_name, new_sequence_name )`

> [!IMPORTANT]
> Rename a sequence - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altersequence.html)

### Arguments

| Name                | Type     | Description                                   |
| ------------------- | -------- | --------------------------------------------- |
| `old_sequence_name` | `string` | old [Name](/migrations/#type) of the sequence |
| `new_sequence_name` | `string` | new [Name](/migrations/#type) of the sequence |
