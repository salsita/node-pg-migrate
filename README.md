# pg-migrate

Node.js database migration management for postgres only.

## Installation

    $ npm install node-pg-migrate

Installing this module adds a runnable file into your `node_modules/.bin` directory. If installed globally (with the -g option), you can run `pg-migrate` and if not, you can run `./node_modules/.bin/pg-migrate`

## Usage

You must specify your database connection url by setting the environment variable `DATABASE_URL`.

Depending on your setup, it may make sense to write some custom grunt tasks that set this env var and run your migration commands. More on that below.

The following are the available commands:

- `pg-migrate create {migration-name}` - creates a new migration file with the name you give it. Spaces and underscores will be replaced by dashes and a timestamp is prepended to your file name. 
- `pg-migrate up` - run all up migrations from the current state
- `pg-migrate up [N]` - run N up migrations from the current position
- `pg-migrate down` - run a single down migration
- `pg-migrate down [N}` - run N down migrations from the current state

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
Generation of the up and down block is asynchronous, but each individal operation is not. Running the migration commands doesn't actually migrate your database. They just add sql commands to a stack that is run after you call the callback. This is part of what makes this tool so easy to use and what makes it possible to infer down migrations (see below).

### Migration methods

The `pgm` object that is passed to each up/down block has many different operations available. Each operation is simply a functions that generates sql and stores it on the current pgm object.

#### `pgm.createExtension`

this.dropExtension = wrap( ops.extensions.drop );

this.createTable = wrap( ops.tables.create );
this.dropTable = wrap( ops.tables.drop );
this.renameTable = wrap( ops.tables.renameTable );

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

this.addExtension = this.createExtension;
this.addColumn = this.addColumns;
this.dropColumn = this.dropColumns;
this.createConstraint = this.addConstraint;
this.addType = this.createType;
this.addIndex = this.createIndex;


