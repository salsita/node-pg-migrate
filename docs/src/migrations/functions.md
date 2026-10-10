# Function Operations

## Operation: `createFunction`

#### `pgm.createFunction( function_name, function_params, function_options, definition )`

> [!IMPORTANT]
> Create a new function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createfunction.html)

### Arguments

| Name               | Type                            | Description                       |
| ------------------ | ------------------------------- | --------------------------------- |
| `function_name`    | [Name](/migrations/#type)       | name of the new function          |
| `function_params`  | `array[string]` `array[object]` | parameters of the new function    |
| `function_options` | `object`                        | Check below for available options |
| `definition`       | `string`                        | definition of function            |

### function_params

Either array of strings or objects.
If array of strings, it is interpreted as is, if array of objects:

| Option    | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| `mode`    | `string` | `IN`, `OUT`, `INOUT`, or `VARIADIC` |
| `name`    | `string` | name of argument                    |
| `type`    | `string` | datatype of argument                |
| `default` | `string` | default value of argument           |

### function_options

| Option     | Type                      | Description                                                                |
| ---------- | ------------------------- | -------------------------------------------------------------------------- |
| `returns`  | `string`                  | returns clause                                                             |
| `language` | `string`                  | language name of function definition                                       |
| `replace`  | `boolean`                 | create or replace function                                                 |
| `window`   | `boolean`                 | window function                                                            |
| `behavior` | `string`                  | `IMMUTABLE`, `STABLE`, or `VOLATILE`                                       |
| `security` | `string`                  | `INVOKER` or `DEFINER`                                                     |
| `onNull`   | `boolean` or `string`     | `true` or `'RETURNS NULL'` for strict; `'CALLED'` for called on null input |
| `parallel` | `string`                  | `UNSAFE`, `RESTRICTED`, or `SAFE`                                          |
| `cost`     | `number`                  | positive finite estimated execution cost, in units of `cpu_operator_cost`  |
| `rows`     | `number`                  | positive finite estimated result row count, for functions returning a set  |
| `support`  | [Name](/migrations/#type) | planner support function name; requires superuser privileges               |

Planner estimates are emitted only when supplied; otherwise PostgreSQL chooses
its defaults. `rows` is valid only for a set-returning function. PostgreSQL
validates the return type, support function signature, and privileges.

Use `onNull: 'CALLED'` with `replace: true` to explicitly replace a strict
function with one that executes on null input. The existing boolean behavior is
preserved: `true` makes the function strict, and `false` omits the clause.

```javascript
pgm.createFunction(
  { schema: 'app', name: 'series' },
  ['integer', 'integer'],
  {
    language: 'internal',
    returns: 'SETOF integer',
    cost: 2.5,
    rows: 100,
    support: { schema: 'pg_catalog', name: 'generate_series_int4_support' },
  },
  'generate_series_int4'
);
```

This example wraps PostgreSQL's built-in integer series function with its matching
support function. A planner support function must implement the contract for the
function it supports; see [PostgreSQL function optimization](https://www.postgresql.org/docs/current/xfunc-optimization.html).

## Reverse Operation: `dropFunction`

#### `pgm.dropFunction( function_name, function_params, drop_options )`

> [!IMPORTANT]
> Drop a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropfunction.html)

### Arguments

| Name              | Type                            | Description                       |
| ----------------- | ------------------------------- | --------------------------------- |
| `function_name`   | [Name](/migrations/#type)       | name of the function to drop      |
| `function_params` | `array[string]` `array[object]` | parameters of the function        |
| `drop_options`    | `object`                        | Check below for available options |

Parameters may be reused from `createFunction`: their `default` values,
including defaults supplied by type shorthands, are omitted from drop SQL.
This also applies when `createFunction` is reversed automatically. Creation
continues to emit defaults, and argument modes, names, and types are preserved.
String parameters and object `type` fields must describe argument types without
inline `DEFAULT` clauses.

```javascript
export const shorthands = {
  defaultInt: { type: 'integer', default: 2 },
};

export function up(pgm) {
  pgm.createFunction(
    'defaulted_function',
    ['defaultInt'],
    { language: 'sql', returns: 'integer' },
    'SELECT $1'
  );
}
// Creation includes (integer DEFAULT 2).
// With down omitted, automatic rollback emits:
// DROP FUNCTION "defaulted_function"(integer);
// An explicit pgm.dropFunction('defaulted_function', ['defaultInt']) does the same.
```

### drop_options

| Option     | Type      | Description                      |
| ---------- | --------- | -------------------------------- |
| `ifExists` | `boolean` | drops function only if it exists |
| `cascade`  | `boolean` | drops also dependent objects     |

## Operation: `renameFunction`

#### `pgm.renameFunction( old_function_name, function_params, new_function_name )`

> [!IMPORTANT]
> Rename a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterfunction.html)

### Arguments

| Name                | Type                            | Description                |
| ------------------- | ------------------------------- | -------------------------- |
| `old_function_name` | [Name](/migrations/#type)       | old name of the function   |
| `function_params`   | `array[string]` `array[object]` | parameters of the function |
| `new_function_name` | [Name](/migrations/#type)       | new name of the function   |

See [Renaming and schemas](/migrations/#renaming-and-schemas) for schema
normalization, automatic reversal, and supported `PgLiteral` names.
The function parameters identify the overload and are preserved during reversal.
Use `[]` for a function with no parameters; include the input argument types to
select an overloaded function.
Parameter objects may be reused from `createFunction`: their `default` values,
including defaults supplied by type shorthands, are omitted from rename SQL.
Argument modes, names, and types are preserved. Renaming does not change the
function's stored defaults; `createFunction` continues to emit them.
String parameters and object `type` fields must describe argument types without
inline `DEFAULT` clauses.

```javascript
pgm.renameFunction({ schema: 'app', name: 'old_function' }, ['integer'], {
  schema: 'app',
  name: 'new_function',
});
// up:   ALTER FUNCTION "app"."old_function"(integer) RENAME TO "new_function";
// down: ALTER FUNCTION "app"."new_function"(integer) RENAME TO "old_function";
```

To move a function between schemas, use SQL explicitly, for example
`pgm.sql('ALTER FUNCTION "old_schema"."my_function"(integer) SET SCHEMA "new_schema"')`.
Provide the corresponding SQL in your down migration to reverse that move.
