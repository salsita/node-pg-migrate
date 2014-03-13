var _ = require('lodash');


var ops = {
  extensions: require('./operations/extensions'),
  indexes: require('./operations/indexes'),
  tables: require('./operations/tables')
}

var MigrationBuilder = function(){
  var steps = [];

  function pushStep(sql){
    // this will be useful to reverse order if auto-building down migrations
    steps.push( sql );
  }

  this.getSql = function(){
    return steps.join("\n")+"\n";
  }

  // extensions
  this.createExtension = function(extensions){
    if ( !_.isArray(extensions) ) extensions = [extensions];
    _.each(extensions, function(extension_name){
      pushStep( ops.extensions.create( extension_name ) );
    });
  }
  this.dropExtension = function(extensions){
    if ( !_.isArray(extensions) ) extensions = [extensions];
    _.each(extensions, function(extension_name){
      pushStep( ops.extensions.drop( extension_name ) );
    });
  }

  // tables
  this.createTable = function(table_name, columns){

  }
  this.dropTable = function(table_name){
    pushStep( sprintf('DROP TABLE %s;', table_name ));
  }

  // indexes
  this.createIndex = function(table_name, options ){

    options.name
    options.unique
    options.where
    options.concurrently
    options.method

  }
  this.dropIndex = function( table_name, options ){
    pushStep( sprintf('DROP INDEX %s;', table_name ));
  }


}


module.exports = MigrationBuilder;