# Cast Operations

### `pgm.createCast( source_type, target_type, opttions )`

> Create a new cast - [postgres docs](https://www.postgresql.org/docs/current/sql-createcast.html)

**Arguments**

- `source_type` _[string]_ - The name of the source data type of the cast
- `target_type` _[string]_ - The name of the target data type of the cast
- `options` _[object]_ - options:

  - `functionName` _[string]_ - Name of function to use to do the cast
  - `argumentTypes` _[array]_ - Array of types of arguments for the function

    Array of strings listing the types of arguments for the conversion
    function. If this is not present, it defaults to just the `source_type`.

  - `inout` _[boolean]_ - Use standard I/O routines for conversion

    Setting this to `true` indicates that conversion should be used by using
    the standard text output conversion for `source_type` and passing the
    result to the input conversion process for `target_type`.

  - `as` _[string]_ - Indicate when this may cast may be done implicitly.

    This may be either `assignment` or `implicit`. If `implicit` is used, the
    cast may be used implicitly in any context; this is not recommended. If
    `assignment` is used the cast will only be done implicitly in
    assignments.

**Reverse Operation:** `dropCast`

---

### `pgm.dropCast( source_type, target_type )`

> Drop a cast - [postgres docs](https://www.postgresql.org/docs/current/sql-dropcast.html)

**Arguments**

- `source_type` _[string]_ - The name of the source data type of the cast
- `target_type` _[string]_ - The name of the target data type of the cast
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - Do not throw an error if the cast does not exist
