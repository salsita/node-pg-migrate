# Cast Operations

### `pgm.createCast( from_type, to_type, opttions )`

> Create a new cast - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createcast.html)

**Arguments**

- `from_type` _[string]_ - Original type to cast from
- `to_type` _[string]_ - Type to cast into
- `options` _[object]_ - options:

  - `functionName` _[string]_ - Name of function to use to do the cast
  - `argumentTypes` _[array]_ - Array of types of arguments for the function

    Array of strings listing the types of arguments for the conversion
    function. If this is not present, it defaults to just the `from_type`.

  - `inout` _[boolean]_ - Use standard I/O routines for conversion

    Setting this to `true` indicates that conversion should be used by using
    the standard text output conversion for `from_type` and passing the
    result to the input conversion process for `to_type`.

  - `as` _[string]_ - Indicate when this may cast may be done implicitly.

    This may be either `assignment` or `implicit`. If `implicit` is used, the
    cast may be used implicitly in any context; this is not recommended. If
    `assignment` is used the cast will only be done implicitly in
    assignments.

**Reverse Operation:** `dropCast`

---

### `pgm.dropCast( from_type, to_type )`

> Drop a cast - [postgres docs](https://www.postgresql.org/docs/current/static/sql-dropcast.html)

**Arguments**

- `from_type` _[string]_ - Original type to cast from
- `to_type` _[string]_ - Type to cast into
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops cast only if it exists
