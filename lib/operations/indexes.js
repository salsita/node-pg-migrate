var utils = require('../utils');
var _ = require('lodash');


var ops = module.exports = {
  create: function( table_name, columns, options ) {
    /*
    columns - the column, columns, or expression to create the index on

    Options
      name - explicitly specify the name for the index
      unique - is this a unique index
      where - where clause
      concurrently - 
      options.method -  [ btree | hash | gist | spgist | gin ]
    */
    options = options || {};

    var sql = utils.t('CREATE {unique} INDEX {concurrently}{index_name} ON "{table_name}"{method} ({columns}){where};', {
        table_name   : table_name,
        index_name   : generateIndexName( table_name, columns, options ),
        columns      : generateColumnsString(columns),
        unique       : options.unique ? ' UNIQUE ' : '',
        concurrently : options.concurrently ? ' CONCURRENTLY ' : '',
        method       : options.method ? ' USING '+options.method : '',
        where        : options.where ? ' WHERE '+options.where : '',
      }
    );
    return sql;
  },

  drop: function ( table_name, columns, options ) {
    options = options || {};
  
    var index_name = generateIndexName( table_name, columns, options );
    return utils.t('DROP INDEX {index};', { index: index_name } );
  }
}

// setup reverse functions
ops.create.reverse = ops.drop;

function generateIndexName( table_name, columns, options ){
  if (options.name) return options.name;

  var name = table_name;
  if ( _.isArray(columns) ) name += columns.join('_');
  else name += columns;
  if (options.unique) name += '_unique';
  name += '_index';
  return name;

  // if (options.unique)
}
function generateColumnsString(columns){
  if ( _.isArray(columns) ) return columns = columns.map(function(name){return '"' + name + '"';}).join(', ');
  if (/.+\(.*\)/.test(columns)) return columns; //expression
  return columns = '"' + columns + '"'; //single column
}