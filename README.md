# pg-migrate

Node.js database migration management built exclusively for postgres.

## Installation

    $ npm install node-pg-migrate

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `pg-migrate` and if not, you can run `./node_modules/.bin/pg-migrate`

## Usage

You must specify your database connection url by setting the environment variable `DATABASE_URL`.

Depending on your project's setup, it may make sense to write some custom grunt tasks that set this env var and run your migration commands. More on that below.

**The following are the available commands:**

- `pg-migrate create {migration-name}` - creates a new migration file with the name you give it. Spaces and underscores will be replaced by dashes and a timestamp is prepended to your file name. 
- `pg-migrate up` - run all up migrations from the current state
- `pg-migrate up {N}` - run N up migrations from the current position
- `pg-migrate down` - run a single down migration
- `pg-migrate down {N}` - run N down migrations from the current state

## Defining Migrations

When you run `pg-migrate create` a new migration file is created that looks like this:

```javascript
exports.up = function(pgm, run){
  run();
}
exports.down = function(pgm, run){
  run();
}
```

`pgm` is a helper object that provides migration operations and `run` is the callback to call when you are done.

**IMPORTANT**
Generation of the up and down block is asynchronous, but each individal operation is not. Calling the migration functions on `pgm` doesn't actually migrate your database. These functions just add sql commands to a stack that is run after you call the callback. This is part of what makes this tool so easy to use and what makes it possible to infer down migrations (see below).

### Migration methods

The `pgm` object that is passed to each up/down block has many different operations available. Each operation is simply a functions that generates some sql and stores it in the current pgm context.




#### :+1: `pgm.createExtension( extension )`

> Install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/9.3/static/sql-createextension.html.html)

**Arguments:**

- `extension` _[string or array of strings]_ - name(s) of extensions to install

**Aliases:** `addExtension`  
**Reverse Operation:** `dropExtension`




#### :+1: `pgm.dropExtension( extension )`

> Un-install postgres extension(s) - [postgres docs](http://www.postgresql.org/docs/9.3/static/sql-dropextension.html)

**Arguments:**

- `extension` _[string or array of strings]_ - name(s) of extensions to install





#### :+1: `pgm.createTable( tablename, columns, options )`

> Create a new table - [postgres docs](http://www.postgresql.org/docs/9.3/static/sql-createtable.html)

**Arguments:**  

- `tablename` _[string]_ - name for the new table
- `columns` _[object]_ - keys are column names, values are column options
- `options` _[object]_ - table options (optional)
  - `inherits` _[string]_ - table to inherit from
 
**Reverse Operation:** `dropTable`




#### :+1: `pgm.dropTable( tablename )`

> Drop existing table - [postgres docs](http://www.postgresql.org/docs/9.3/static/sql-droptable.html)

**Arguments:**  

- `tablename` _[string]_ - name of the table to drop




#### :+1: `pgm.renameTable( tablename, new_tablename )`

> Rename a table - [postgres docs](http://www.postgresql.org/docs/9.3/static/sql-altertable.html)

**Arguments:**  

- `tablename` _[string]_ - name of the table to rename
- `new_table` _[object]_ - new name of the table
 
**Reverse Operation:** `undoRenameTable` (same operation in opposite direction - should not be used manually)


this.addColumns = wrap( ops.tables.addColumns );
this.dropColumns = wrap( ops.tables.dropColumns );
this.renameColumn = wrap( ops.tables.renameColumn );
this.alterColumn = wrap( ops.tables.alterColumn );


this.addConstraint = wrap( ops.tables.addConstraint );
this.dropConstraint = wrap( ops.tables.dropConstraint );


this.createType = wrap( ops.tables.createType );
this.dropType = wrap( ops.tables.dropType );
this.alterType = wrap( ops.tables.alterType );


this.createIndex = wrap( ops.indexes.create );
this.dropIndex = wrap( ops.indexes.drop );

this.sql = wrap( ops.other.sql );

this.addColumn = this.addColumns;
this.dropColumn = this.dropColumns;
this.createConstraint = this.addConstraint;
this.addType = this.createType;
this.addIndex = this.createIndex;

