# Sequence Operations

## Sequence Options

The `createSequence` and `alterSequence` methods both take an `options` argument that specifies parameters of sequence.

- `type` _[string]_ - type of the sequence
- `increment` _[number]_ - sets first value of sequence
- `minvalue` _[number or boolean]_ - sets minimum value of sequence or `NO MINVALUE` (if value is false or null)
- `maxvalue` _[number or boolean]_ - sets maximum value of sequencee or `NO MAXVALUE` (if value is false or null)
- `start` _[number]_ - sets first value of sequence
- `cache` _[number]_ - sets how many sequence numbers should be preallocated
- `cycle` _[boolean]_ - adds `CYCLE` or `NO CYCLE` clause if option is present
- `owner` _[string or boolean]_ - sets owner of sequence or no owner (if value is false or null)

### `pgm.createSequence( sequence_name, options )`

> Create a new sequence - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createsequence.html)

**Arguments:**

- `sequence_name` _[[Name](migrations.md#type)]_ - name of the new sequence
- `options` _[object]_ - options:
  - sequence options -- see [sequence options section](#sequence-options)
  - `temporary` _[boolean]_ - adds `TEMPORARY` clause
  - `ifNotExists` _[boolean]_ - adds `IF NOT EXISTS` clause

**Reverse Operation:** `dropSequence`

---

### `pgm.dropSequence( sequence_name, drop_options )`

> Drop a sequence - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropsequence.html)

**Arguments:**

- `sequence_name` _[[Name](migrations.md#type)]_ - name of the the sequence to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops sequence only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

---

### `pgm.alterSequence( sequence_name, options )`

> Alter a sequence - [postgres docs](https://www.postgresql.org/docs/current/static/sql-altersequence.html)

**Arguments:**

- `sequence_name` _[[Name](migrations.md#type)]_ - name of the new sequence
- `options` _[object]_ - options:
  - sequence options -- see [sequence options section](#sequence-options)
  - `restart` _[number or boolean]_ - sets first value of sequence or using `start` value (on true value)

---

### `pgm.renameSequence( old_sequence_name, new_sequence_name )`

> Rename a sequence - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altersequence.html)

**Arguments:**

- `old_sequence_name` _[[Name](migrations.md#type)]_ - old name of the sequence
- `new_sequence_name` _[[Name](migrations.md#type)]_ - new name of the sequence
