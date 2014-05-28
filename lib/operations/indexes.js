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
    if ( _.isArray(columns) ) columns = columns.join(', ');

    var sql = utils.t('CREATE {unique} INDEX {concurrently}{index_name} ON {table_name}{method} ({columns}){where};', {
        table_name   : table_name,
        index_name   : generateIndexName( table_name, columns, options ),
        columns      : columns,
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
    if (_.isArray(columns)) columns = columns.join(', ');
    var index_name = generateIndexName( table_name, columns, options );
    return utils.t('DROP INDEX {index};', { index: index_name } );
  }
}

// setup reverse functions
ops.create.reverse = ops.drop;

function generateIndexName( table_name, columns, options ){
  if (options.name) return options.name;

  var name = table_name;
  name += '_' + columns.replace(/, /g, '_');
  if (options.unique) name += '_unique';
  name += '_index';
  return name;

  // if (options.unique)
}
