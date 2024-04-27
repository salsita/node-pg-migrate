# Cast Operations

## Operation: `createCast`

#### `pgm.createCast( source_type, target_type, opttions )`

> [!IMPORTANT]
> Create a new cast - [postgres docs](https://www.postgresql.org/docs/current/sql-createcast.html)

### Arguments

| Name          | Type     | Description                                  |
|---------------|----------|----------------------------------------------|
| `source_type` | `string` | The name of the source data type of the cast |
| `target_type` | `string` | The name of the target data type of the cast |
| `options`     | `object` | Check below for available options            |

#### Options

| Option          | Type      | Description                                        |
|-----------------|-----------|----------------------------------------------------|
| `functionName`  | `string`  | Name of function to use to do the cast             |
| `argumentTypes` | `array`   | Array of types of arguments for the function       |
| `inout`         | `boolean` | Use standard I/O routines for conversion           |
| `as`            | `string`  | Indicate when this may cast may be done implicitly |

##### Tips

- `argumentTypes`: Is an array of strings listing the types of arguments for the conversion function. If this is not
  present, it defaults to just the `source_type`.
- `inout`: Setting this to `true` indicates that conversion should be used by using
  the standard text output conversion for `source_type` and passing the
  result to the input conversion process for `target_type`.

- `as`: This may be either `assignment` or `implicit`. If `implicit` is used, the
  cast may be used implicitly in any context; this is not recommended. If
  `assignment` is used the cast will only be done implicitly in
  assignments.

## Reverse Operation: `dropCast`

#### `pgm.dropCast( source_type, target_type )`

> [!IMPORTANT]
> Drop a cast - [postgres docs](https://www.postgresql.org/docs/current/sql-dropcast.html)

### Arguments

| Name          | Type     | Description                                  |
|---------------|----------|----------------------------------------------|
| `source_type` | `string` | The name of the source data type of the cast |
| `target_type` | `string` | The name of the target data type of the cast |
| `options`     | `object` | Check below for available options            |

#### Options

| Option     | Type      | Description                                      |
|------------|-----------|--------------------------------------------------|
| `ifExists` | `boolean` | Do not throw an error if the cast does not exist |
