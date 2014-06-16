/*
  The migration builder is used to actually create a migration from instructions

  A new instance of MigrationBuilder is instantiated and passed to the up or down block
  of each migration when it is being run.

  It makes the methods available via the pgm variable and stores up the sql commands.
  This is what makes it possible to do this without making everything async
  and it makes inferrence of down migrations possible.


*/

var _ = require('lodash');
var utils = require('./utils');

var ops = {
  extensions: require('./operations/extensions'),
  indexes: require('./operations/indexes'),
  tables: require('./operations/tables'),
  other: require('./operations/other')
}

var MigrationBuilder = function(){
  var self = this;
  var steps = [];
  var REVERSE_MODE = false;

  // by default, all migrations are wrapped in a transaction
  this.use_transaction = true;

  this.enableReverseMode = function(){
    REVERSE_MODE = true;
  }
  this.noTransaction = function(){
    self.use_transaction = false;
  }

  this.getSql = function(){
    // in reverse mode, we flip the order of the statements
    if (REVERSE_MODE){
      steps = steps.reverse();
    }
    return steps.join("\n")+"\n";
  }
  this.getSqlSteps = function(){
    return REVERSE_MODE ? steps.reverse() : steps;
  }

  // this function wraps each operation within a function that either
  // calls the operation or its reverse, and appends the result (array of sql statements)
  // to the  steps array
  function wrap(operation){
    return function(){
      if (REVERSE_MODE) {
        if ( typeof operation.reverse !== 'function' ){
          throw new Error('Impossible to automatically infer down migration');
        }
        steps = steps.concat( operation.reverse.apply( self, arguments ) );
      } else {
        steps = steps.concat( operation.apply( self, arguments ) );
      }
    }
  }


  // defines the methods that are accessible via pgm in each migrations
  // there are some convenience aliases to make usage easier
  this.createExtension = wrap( ops.extensions.create );
  this.dropExtension = wrap( ops.extensions.drop );
  this.addExtension = this.createExtension;

  this.createTable = wrap( ops.tables.create );
  this.dropTable = wrap( ops.tables.drop );
  this.renameTable = wrap( ops.tables.renameTable );

  this.addColumns = wrap( ops.tables.addColumns );
  this.dropColumns = wrap( ops.tables.dropColumns );
  this.renameColumn = wrap( ops.tables.renameColumn );
  this.alterColumn = wrap( ops.tables.alterColumn );
  this.addColumn = this.addColumns;
  this.dropColumn = this.dropColumns;

  this.addConstraint = wrap( ops.tables.addConstraint );
  this.dropConstraint = wrap( ops.tables.dropConstraint );
  this.createConstraint = this.addConstraint;

  this.createType = wrap( ops.tables.createType );
  this.dropType = wrap( ops.tables.dropType );
  this.alterType = wrap( ops.tables.alterType );
  this.addType = this.createType;

  this.createIndex = wrap( ops.indexes.create );
  this.dropIndex = wrap( ops.indexes.drop );
  this.addIndex = this.createIndex;

  this.sql = wrap( ops.other.sql );


  // Other utilities which may be useful
  // .func creates a string which will not be escaped
  // common uses are for PG functions, ex: { ... default: pgm.func('NOW()') }
  this.func = utils.PgLiteral.create;
}

module.exports = MigrationBuilder;