# pg-migrate

[![Dependency Status](https://img.shields.io/david/theoephraim/node-pg-migrate.svg)](https://david-dm.org/theoephraim/node-pg-migrate)
[![devDependency Status](https://img.shields.io/david/dev/theoephraim/node-pg-migrate.svg)](https://david-dm.org/theoephraim/node-pg-migrate?type=dev)
[![peerDependencies Status](https://img.shields.io/david/peer/theoephraim/node-pg-migrate.svg)](https://david-dm.org/theoephraim/node-pg-migrate?type=peer)
[![optionalDependencies Status](https://img.shields.io/david/optional/theoephraim/node-pg-migrate.svg)](https://david-dm.org/theoephraim/node-pg-migrate?type=optional)
[![NPM version](https://img.shields.io/npm/v/node-pg-migrate.svg)](https://www.npmjs.com/package/node-pg-migrate)
![Downloads](https://img.shields.io/npm/dm/node-pg-migrate.svg?style=flat)
![Licence](https://img.shields.io/npm/l/node-pg-migrate.svg?style=flat)

Node.js database migration management built exclusively for postgres.

## Installation

    $ npm install node-pg-migrate

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `pg-migrate` and if not, you can run `./node_modules/.bin/pg-migrate`

## Usage

You can specify your database connection information using [config](https://www.npmjs.com/package/config).

```json
// config/default.json
{
  "db": "postgres://postgres:password@localhost:5432/name"
}
```

or

```json
// config/default.json
{
  "db": {
    "user": "postgres",
    "password": "",
    "host": "localhost",
    "port": 5432,
    "name": "name"
  }
}
```

You could also specify your database url by setting the environment variable `DATABASE_URL`.

```
DATABASE_URL=postgres://postgres@localhost/name node-pg-migrate
```

You can specify custom JSON file with config (format is same as for `db` entry of [config](https://www.npmjs.com/package/config) file), for example:

```json
// path/to/config.json
{
  "user": "postgres",
  "password": "",
  "host": "localhost",
  "port": 5432,
  "name": "name"
}
```

If a .env file exists, it will be loaded using [dotenv](https://www.npmjs.com/package/dotenv) (if installed) when running the pg-migrate binary.

Depending on your project's setup, it may make sense to write some custom grunt tasks that set this env var and run your migration commands. More on that below.

**The following are the available commands:**

- `pg-migrate create {migration-name}` - creates a new migration file with the name you give it. Spaces and underscores will be replaced by dashes and a timestamp is prepended to your file name.
- `pg-migrate up` - runs all up migrations from the current state.
- `pg-migrate up {N}` - runs N up migrations from the current state.
- `pg-migrate down` - runs a single down migration.
- `pg-migrate down {N}` - runs N down migrations from the current state.
- `pg-migrate unlock` - unlocks migrations (if previous up/down migration failed and was not automatically unlocked).
- `pg-migrate redo` - redoes last migration (runs a single down migration, then single up migration).
- `pg-migrate redo {N}` - redoes N last migrations (runs N down migrations, then N up migrations).

### Configuration

You can adjust defaults by passing arguments to `pg-migrate`:

* `config-file` (`f`) - The file with migration JSON config (defaults to undefined)
* `schema` (`s`) - The schema on which migration will be run (defaults to `public`)
* `database-url-var` (`d`) - Name of env variable with database url string (defaults to `DATABASE_URL`)
* `migrations-dir` (`m`) - The directory containing your migration files (defaults to `migrations`)
* `migrations-schema` - The schema storing table which migrations have been run (defaults to same value as `schema`)
* `migrations-table` (`t`) - The table storing which migrations have been run (defaults to `pgmigrations`)

* `check-order` - Check order of migrations before running them (defaults to `true`, to switch it off supply `--no-check-order` on command line).
                  (There should be no migration with timestamp lesser than last run migration.)

See all by running `pg-migrate --help`.

Most of configuration options can be also specified in [config](https://www.npmjs.com/package/config) file.

For SSL connection to DB you can set `PGSSLMODE` environment variable to value from [list](https://www.postgresql.org/docs/current/static/libpq-connect.html#LIBPQ-CONNECT-SSLMODE) other then `disable`.
e.g. `PGSSLMODE=require pg-migrate up` ([pg](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md#v260) will take it into account)

#### JSON Configuration

You can use [config](https://www.npmjs.com/package/config) or your own json file with configuration (`config-file` command line option).

Available options are:

* `migrations-dir`, `migrations-schema`, `migrations-table`, `check-order` - same as above

* either `url` or [`user`], [`password`], `host` (defaults to localhost), `port` (defaults to 5432), `name` - for connection details

* `type-shorthands` - for column type shorthands

  You can specify custom types which will be expanded to column definition (e.g. for `module.exports = { "type-shorthands": { id: { type: 'uuid', primaryKey: true }, createdAt: { type: 'timestamp', notNull: true, default: new require('node-pg-migrate').PgLiteral('current_timestamp') } } }`
  it will in `pgm.createTable('test', { id: 'id', createdAt: 'createdAt' });` produce SQL `CREATE TABLE "test" ("id" uuid PRIMARY KEY, "createdAt" timestamp DEFAULT current_timestamp NOT NULL);`).

### Locking

`pg-migrate` automatically checks if no other migration is running. To do so, it locks the migration table and enters comment there.
There are other options how to do it, but I choose this one (see #88).
In some circumstances it is possible that lock will not be released (Error message - `Error: Unable to fetch migrations: Error: Another migration is already running`).
In that case you need to run `pg-migrate unlock` to release the lock again.


## Defining Migrations

When you run `pg-migrate create` a new migration file is created that looks like this:

```javascript
exports.up = function up(pgm) {

}
exports.down = function down(pgm) {

}
```

`pgm` is a helper object that provides migration operations and `run` is the callback to call when you are done.

**IMPORTANT**
Calling the migration functions on `pgm` doesn't actually migrate your database. These functions just add sql commands to a stack that is run.

#### Automatic Down Migrations

If `exports.down` is not present in a migration, pg-migrate will try to automatically infer the operations that make up the down migration by reversing the operations of the up migration. Only some operations have automatically inferrable equivalents (details below on each operation). Sometimes, migrations are destructive and cannot be rolled back. In this case, you can set `exports.down = false` to tell pg-migrate that the down migration is impossible.

#### Async Migrations

In some cases, you may want to perform some async operation during a migration, for example fetching some information from an external server, or inserting some data into the database. To make a migration block operate in async mode, just add another callback argument to the function signature. However, be aware that NONE of the pgm operations will be executed until `run()` is called. Here's an example:

```javascript
exports.up = function up(pgm, run) {
  doSomethingAsync(function() {
    run();
  });
}
```

Another way how to perform some async operation is to return [Promise](https://promisesaplus.com/) from `up` or `down` function. Example:

```javascript
exports.up = function(pgm) {
  return new Promise(resolve => {
    // doSomethingAsync
    resolve();
  });
}
```


## Migration methods

The `pgm` object that is passed to each up/down block has many different operations available. Each operation is simply a function that generates some sql and stores it in the current pgm context.

By default, each migration will be run in a transaction. To disable transactions for a specific migration, call `pgm.noTransaction()`
This is required for some SQL operations that cannot be run within a transaction. It should be used carefully.

### Creating & Altering Tables / Columns

#### `pgm.createTable( tablename, columns, options )`

> Create a new table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtable.html)

**Arguments:**
- `tablename` _[string]_ - name for the new table
- `columns` _[object]_ - column names / options -- see [column definitions section](#column-definitions)
- `options` _[object]_ - table options (optional)
  - `temporary` _[bool]_ - default false
  - `ifNotExists` _[bool]_ - default false
  - `inherits` _[string]_ - table(s) to inherit from
  - `constraints` _[object]_ - table constraints
    - `check` _[string]_ - sql for a check constraint
    - `unique` _[string or array of strings]_ - names of unique columns
    - `primaryKey` _[string or array]_ - names of primary columns
    - `exclude` _[string]_ - sql for an exclude constraint
    - `deferrable` _[boolean]_ - flag for deferrable table
    - `deferred` _[boolean]_ - flag for initially deferred deferrable table
    - `foreignKeys` _[object or array of objects]_ - foreign keys specification
      - `columns` _[string or array of strings]_ - names of columns
      - `references` _[string]_ - names of foreign table and column names
      - `onDelete` _[string]_ - action to perform on delete
      - `onUpdate` _[string]_ - action to perform on update
      - `match` _[string]_ - `FULL` or `SIMPLE`
  - `like` _[string]_ - table(s) to inherit from

**Reverse Operation:** `dropTable`

-----------------------------------------------------

#### `pgm.dropTable( tablename, options )`

> Drop existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to drop
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops table only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

-----------------------------------------------------

#### `pgm.renameTable( tablename, new_tablename )`

> Rename a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to rename
- `new_table` _[object]_ - new name of the table

**Reverse Operation:** same operation in opposite direction

-----------------------------------------------------

#### `pgm.addColumns( tablename, new_columns )`

> Add columns to an existing table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `new_columns` _[object]_ - column names / options -- see [column definitions section](#column-definitions)

**Aliases:** `addColumn`
**Reverse Operation:** `dropColumns`

-----------------------------------------------------

#### `pgm.dropColumns( tablename, columns, options )`

> Drop columns from a table - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `columns` _[array of strings or object]_ - columns to drop (if object, uses keys)
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops column only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

**Aliases:** `dropColumn`

-----------------------------------------------------

#### `pgm.renameColumn( tablename, old_column_name, new_column_name )`

> Rename a column - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `old_column_name` _[string]_ - current column name
- `new_column_name` _[string]_ - new column name

**Reverse Operation:** same operation in opposite direction

-----------------------------------------------------

#### `pgm.alterColumn( tablename, column_name, column_options )`

> Alter a column (default value, type, allow null) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `column_name` _[string]_ - column to alter
- `column_options` _[object]_ - optional new column options
  - `default` _[string or null]_ - null, string
  - `type` _[string]_ - new datatype
  - `notNull` _[boolean]_ - sets NOT NULL if true
  - `using` _[string]_ - adds USING clause to change values in column
  - `collation` _[string]_ - adds COLLATE clause to change values in column

-----------------------------------------------------

#### `pgm.addConstraint( tablename, constraint_name, expression )`

> Add a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `constraint_name` _[string]_ - name for the constraint
- `expression` _[string or object]_ - constraint expression (raw sql) or see [constraints section of create table](#pgmcreatetable-tablename-columns-options-)

**Aliases:** `createConstraint`
**Reverse Operation:** `dropConstraint`

-----------------------------------------------------

#### `pgm.dropConstraint( tablename, constraint_name, options )`

> Drop a named column constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `constraint_name` _[string]_ - name for the constraint
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops constraint only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

#### `pgm.renameConstraint( tablename, old_constraint_name, new_constraint_name )`

-----------------------------------------------------

> Rename a constraint - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertable.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `old_constraint_name` _[string]_ - current constraint name
- `new_constraint_name` _[string]_ - new constraint name

**Reverse Operation:** same operation in opposite direction

-----------------------------------------------------

#### `pgm.createIndex( tablename, columns, options )`

> Create a new index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createindex.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `columns` _[string or array of strings]_ - columns to add to the index
- `options` _[index options]_ - optional options:
  - `name` _[string]_ - name for the index (one will be inferred from table/columns if undefined)
  - `unique` _[boolean]_ - set to true if this is a unique index
  - `where` _[string]_ - raw sql for where clause of index
  - `concurrently` _[boolean]_ - create this index concurrently
  - `method` _[string]_ - btree | hash | gist | spgist | gin

**Aliases:** `addIndex`
**Reverse Operation:** `dropIndex`

-----------------------------------------------------

#### `pgm.dropIndex( tablename, columns, options )`

> Drop an index - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropindex.html)

**Arguments:**
- `tablename` _[string]_ - name of the table to alter
- `columns` _[string or array of strings]_ - column names, used only to infer an index name
- `options` _[index options]_ - optional options:
  - `name` _[string]_ - name of the index to drop

-----------------------------------------------------

### Extension Operations

#### `pgm.createExtension( extension )`

> Install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createextension.html.html)

**Arguments:**
- `extension` _[string or array of strings]_ - name(s) of extensions to install

**Aliases:** `addExtension`
**Reverse Operation:** `dropExtension`

-----------------------------------------------------

#### `pgm.dropExtension( extension )`

> Un-install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropextension.html)

**Arguments:**
- `extension` _[string or array of strings]_ - name(s) of extensions to install

-----------------------------------------------------

### Type Operations

#### `pgm.createType( type_name, values )`

> Create a new data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createtype.html)

**Arguments:**
- `type_name` _[string]_ - name of the new type
- `values` _[array of strings or object]_ if an array the contents are possible values for an enum type, if an object names and types for a composite type

**Aliases:** `addType`
**Reverse Operation:** `dropType`

-----------------------------------------------------

#### `pgm.dropType( type_name )`

> Drop a custom data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptype.html)

**Arguments:**
- `type_name` _[string]_ - name of the new type

-----------------------------------------------------

#### `pgm.renameType( type_name, new_type_name )`

> Rename a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type to rename
- `new_type_name` _[string]_ - name of the new type

-----------------------------------------------------

#### `pgm.addTypeAttribute( type_name, attribute_name, attribute_type )`

> Add attribute to an existing data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to add
- `attribute_type` _[string]_ - type of the attribute to add

-----------------------------------------------------

#### `pgm.dropTypeAttribute( type_name, attribute_name, options )`

> Drop attribute from a data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to drop
- `options` _[object]_ - options:
  - `ifExists` _[boolean]_ - default false

-----------------------------------------------------

#### `pgm.setTypeAttribute( type_name, attribute_name, attribute_type )`

> Set data type of an existing attribute of data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute
- `attribute_type` _[string]_ - new type of the attribute

-----------------------------------------------------

#### `pgm.addTypeValue( type_name, value, options )`

> Add value to a list of enum data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type
- `value` _[string]_ - value to add to list
- `options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - default false
  - `before` _[string]_ - value before which the new value should be add
  - `after` _[string]_ - value after which the new value should be add

-----------------------------------------------------

#### `pgm.renameTypeAttribute( type_name, attribute_name, new_attribute_name )`

> Rename an attribute of data type - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertype.html)

**Arguments:**
- `type_name` _[string]_ - name of the type
- `attribute_name` _[string]_ - name of the attribute to rename
- `new_attribute_name` _[string]_ - new name of the attribute

-----------------------------------------------------

### Role Operations

#### `pgm.createRole( role_name, role_options )`

> Create a new role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createrole.html)

**Arguments:**
- `role_name` _[string]_ - name of the new role
- `role_options` _[object]_ - options:
  - `superuser` _[boolean]_ - default false
  - `createdb` _[boolean]_ - default false
  - `createrole` _[boolean]_ - default false
  - `inherit` _[boolean]_ - default true
  - `login` _[boolean]_ - default false
  - `replication` _[boolean]_ - default false
  - `bypassrls` _[boolean]_
  - `limit` _[number]_ -
  - `password` _[string]_ -
  - `encrypted` _[boolean]_ - default true
  - `valid` _[string]_ - timestamp
  - `inRole` _[string or array of strings]_ - role or array of roles
  - `role` _[string or array of strings]_ - role or array of roles
  - `admin` _[string or array of strings]_ - role or array of roles

**Reverse Operation:** `dropRole`

-----------------------------------------------------

#### `pgm.dropRole( role_name )`

> Drop a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droprole.html)

**Arguments:**
- `role_name` _[string]_ - name of the new role

-----------------------------------------------------

#### `pgm.alterRole( role_name, role_options )`

> Alter a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

**Arguments:**
- `role_name` _[string]_ - name of the new role
- `role_options` _[object]_ - [see](#pgmcreaterole-role_name-role_options-)

-----------------------------------------------------

#### `pgm.renameRole( old_role_name, new_role_name )`

> Rename a role - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterrole.html)

**Arguments:**
- `old_role_name` _[string]_ - old name of the role
- `new_role_name` _[string]_ - new name of the role

-----------------------------------------------------

### Function Operations

#### `pgm.createFunction( function_name, function_params, function_options, definition )`

> Create a new function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-createfunction.html)

**Arguments:**
- `function_name` _[string]_ - name of the new function
- `function_params` _[array]_ - parameters of the new function

  Either array of strings or objects.
  If array of strings, it is interpreted as is, if array of objects:
  - `mode` _[string]_ - `IN`, `OUT`, `INOUT`, or `VARIADIC`
  - `name` _[string]_ - name of argument
  - `type` _[string]_ - datatype of argument
  - `default` _[string]_ - default value of argument
- `function_options` _[object]_ - options:
  - `returns` _[string]_ - returns clause
  - `language` _[string]_ - language name of function definition
  - `replace` _[boolean]_ - create or replace function
  - `delimiter` _[string]_ - delimiter for definition
  - `window` _[boolean]_ - window function
  - `behavior` _[string]_ - `IMMUTABLE`, `STABLE`, or `VOLATILE`
  - `onNull` _[boolean]_ - `RETURNS NULL ON NULL INPUT`
  - `parallel` _[string]_ - `UNSAFE`, `RESTRICTED`, or `SAFE`
- `definition` _[string]_ - definition of function

**Reverse Operation:** `dropFunction`

-----------------------------------------------------

#### `pgm.dropFunction( function_name, function_params, drop_options )`

> Drop a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropfunction.html)

**Arguments:**
- `function_name` _[string]_ - name of the the function to drop
- `function_params` _[array]_ - [see](#pgmcreatefunction-function_name-function_params-function_options-definition-)
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops function only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

-----------------------------------------------------

#### `pgm.renameFunction( old_function_name, function_params, new_function_name )`

> Rename a function - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterfunction.html)

**Arguments:**
- `old_function_name` _[string]_ - old name of the function
- `function_params` _[array]_ - [see](#pgmcreatefunction-function_name-function_params-function_options-definition-)
- `new_function_name` _[string]_ - new name of the function

-----------------------------------------------------

### Trigger Operations

#### `pgm.createTrigger( table_name, trigger_name, trigger_options )`

> Create a new trigger - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createtrigger.html)

**Arguments:**
- `table_name` _[string]_ - name of the table where the new trigger will live
- `trigger_name` _[string]_ - name of the new trigger
- `trigger_options` _[object]_ - options:
  - `when` _[string]_ - `BEFORE`, `AFTER`, or `INSTEAD OF`
  - `operation` _[string or array of strings]_ - `INSERT`, `UPDATE[ OF ...]`, `DELETE` or `TRUNCATE`
  - `constraint` _[boolean]_ - creates constraint trigger
  - `function` _[string]_ - the name of procedure to execute
  - `level` _[string]_ - `STATEMENT`, or `ROW`
  - `condition` _[string]_ - condition to met to execute trigger
  - `deferrable` _[boolean]_ - flag for deferrable constraint trigger
  - `deferred` _[boolean]_ - flag for initially deferred deferrable constraint trigger
- `definition` _[string]_ - optional definition of function which will be created with same name as trigger

**Reverse Operation:** `dropTrigger`

-----------------------------------------------------

#### `pgm.dropTrigger( table_name, trigger_name, drop_options )`

> Drop a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-droptrigger.html)

**Arguments:**
- `table_name` _[string]_ - name of the table where the trigger lives
- `trigger_name` _[string]_ - name of the the trigger to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops trigger only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

-----------------------------------------------------

#### `pgm.renameTrigger( table_name, old_trigger_name, new_trigger_name )`

> Rename a trigger - [postgres docs](http://www.postgresql.org/docs/current/static/sql-altertrigger.html)

**Arguments:**
- `table_name` _[string]_ - name of the table where the trigger lives
- `old_trigger_name` _[string]_ - old name of the trigger
- `new_trigger_name` _[string]_ - new name of the trigger

-----------------------------------------------------

### Schema Operations

#### `pgm.createSchema( schema_name, schema_options )`

> Create a new schema - [postgres docs](https://www.postgresql.org/docs/current/static/sql-createschema.html)

**Arguments:**
- `schema_name` _[string]_ - name of the new schema
- `schema_options` _[object]_ - options:
  - `ifNotExists` _[boolean]_ - adds `IF NOT EXISTS` clause
  - `authorization` _[string]_ - alternative user to own new schema

**Reverse Operation:** `dropSchema`

-----------------------------------------------------

#### `pgm.dropSchema( schema_name, drop_options )`

> Drop a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-dropschema.html)

**Arguments:**
- `schema_name` _[string]_ - name of the the schema to drop
- `drop_options` _[object]_ - options:
  - `ifExists` _[boolean]_ - drops schema only if it exists
  - `cascade` _[boolean]_ - drops also dependent objects

-----------------------------------------------------

#### `pgm.renameSchema( old_schema_name, new_schema_name )`

> Rename a schema - [postgres docs](http://www.postgresql.org/docs/current/static/sql-alterschema.html)

**Arguments:**
- `old_schema_name` _[string]_ - old name of the schema
- `new_schema_name` _[string]_ - new name of the schema

-----------------------------------------------------

### Miscellaneous Operations

#### `pgm.sql( sql )`

> Run raw sql -- with some optional _[very basic](http://mir.aculo.us/2011/03/09/little-helpers-a-tweet-sized-javascript-templating-engine/)_ mustache templating

**Arguments:**
- `sql` _[string]_ - SQL query to run
- `args` _[object]_ - (optional) key/val of arguments to replace

-----------------------------------------------------

#### `pgm.func( sql )`

> Inserts raw string, which is not escaped

e.g. `pgm.func('CURRENT_TIMESTAMP')` to use in `default` option for column definition

**Arguments:**
- `sql` _[string]_ - string to not be escaped

-----------------------------------------------------

### Column Definitions

The `createTable` and `addColumns` methods both take a `columns` argument that specifies column names and options. It is a object (key/value) where each key is the name of the column, and the value is another object that defines the options for the column.

- `type` _[string]_ - data type (use normal postgres types)
- `collation` _[string]_ - collation of data type
- `unique` _[boolean]_ - set to true to add a unique constraint on this column
- `primaryKey` _[boolean]_ - set to true to make this column the primary key
- `notNull` _[boolean]_ - set to true to make this column not null
- `default` _[string]_ - adds DEFAULT clause for column
- `check` _[string]_ - sql for a check constraint for this column
- `references` _[string]_ - a table name that this column is a foreign key to
- `onDelete` _[string]_ - adds ON DELETE constraint for a reference column
- `onUpdate` _[string]_ - adds ON UPDATE constraint for a reference column
- `match` _[string]_ - `FULL` or `SIMPLE`

#### Data types & Convenience Shorthand
Data type strings will be passed through directly to postgres, so write types as you would if you were writing the queries by hand.

**There are some aliases on types to make things more foolproof:**
_(int, string, float, double, datetime, bool)_

**There is a shorthand to pass only the type instead of an options object:**
`pgm.addColumns('myTable', { age: 'integer' });`
is equivalent to
`pgm.addColumns('myTable', { age: { type: 'integer' } });`

**There is a shorthand for normal auto-increment IDs:**
`pgm.addColumns('myTable', { id: 'id' });`
is equivalent to
`pgm.addColumns('myTable', { id: { type: 'serial', primaryKey: true } });`

### Using schemas

Instead of passing string as name to `pgm` functions, you can pass an object with keys `schema` and `name`. E.g.

`pgm.createTable( {schema: 'my_schema', name: 'my_table_name'}, {id: 'serial'});`

will generate

```sql
CREATE TABLE "my_schema"."my_table_name" (
 "id" serial
);
```


## Explanation & Goals

*Why only Postgres?* - By writing this migration tool specifically for postgres instead of accommadating many databases, we can actually provide a full featured tool that is much simpler to use and maintain. I was tired of using crippled database tools just in case one day we switch our database.

*Async / Sync* - Everything is async in node, and that's great, but a migration tool should really just be a fancy wrapper that generates SQL. Most other migration tools force you to bring in control flow libraries or wrap everything in callbacks as soon as you want to do more than a single operation in a migration. Plus by building up a stack of operations, we can automatically infer down migrations (sometimes) to save even more time.

*Naming / Raw Sql* - Many tools force you to use their constants to do things like specify data types. Again, this tool should be a fancy wrapper that generates SQL, so whenever possible, it should just pass through user values directly to the SQL. The hard part is remembering the syntax of the specific operation, not remembering how to type "timestamp"!


## License

The MIT License (MIT)

Copyright (c) 2016 Jan Dolezel &lt;dolezel.jan@gmail.com&gt;

Copyright (c) 2014 Theo Ephraim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
