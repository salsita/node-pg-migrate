var utils = require('../utils');
var _ = require('lodash');

module.exports = {
  create: function( table_name, columns, options ) {
    /*
    columns - hash of columns 

    Options
      inherits - parent table name
      unique - is this a unique index
      where - where clause
      concurrently - 
      options.method -  [ btree | hash | gist | spgist | gin ]
    */
    var sql = utils.t('CREATE TABLE {table_name} ({columns}) {inherits};', {
      table_name   : table_name,
      columns      : parseColumns( columns ),
      inherits     : options.inherits ? ' INHERITS '+options.inherits : '',
    });
    return sql;
  },

  drop: function ( table_name ) {
    return utils.t('DROP TABLE {table_name};', { table_name: table_name } );
  },

  addColumns: function () {

  },

  dropColumns: function () {

  },

  alterColumns: function () {

  }
}



function parseColumns ( columns ){
  _.each(columns, function( column_name, options ){
    
  });
}