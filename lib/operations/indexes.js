var utils = require('../utils');

module.exports = {
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
    var sql = utils.t('CREATE {unique} INDEX {concurrently} {index_name} ON {table_name} {method} ({columns}) {where}', {
        table_name   : table_name,
        index_name   : generateIndexName( table_name, options ),
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
    var index_name = generateIndexName( table_name, options );
    return utils.t('DROP INDEX {index};', { index: index_name } );
  }
}
function generateIndexName( table_name, options ){
  if (options.name) return options.name;

  var name = table_name;

  return name + '_index';

  // if (options.unique)
}