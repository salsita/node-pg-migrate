var utils = require('../utils');
var _ = require('lodash');

var ops = module.exports = {
  create: function( table_name, columns, options ) {
    /*
    columns - hash of columns

    Options
      table_name - the name of the table
      columns - see column options
      options.inherits - table to inherit from (optional)
    */
    options = options || {};
    var sql = utils.t("CREATE TABLE \"{table_name}\" (\n{columns}\n){inherits};", {
      table_name   : table_name,
      columns      : parseColumns( columns ).replace(/^/gm, '  '),
      inherits     : options.inherits ? ' INHERITS '+options.inherits : '',
    });
    return sql;
  },

  drop: function ( table_name ) {
    return utils.t('DROP TABLE \"{table_name}\";', { table_name: table_name } );
  },

  addColumns: function ( table_name, columns ) {
    return utils.t("ALTER TABLE \"{table_name}\" \n{actions};", {
      table_name: table_name,
      actions: parseColumns( columns ).replace(/^/gm, '  ADD '),
    });
  },
  dropColumns: function ( table_name, columns ) {
    if ( typeof columns === 'string' ) {
      columns = [columns];
    } else if ( !_.isArray(columns) && typeof columns === 'object' ){
      columns = _.keys(columns);
    }
    return utils.t("ALTER TABLE \"{table_name}\" \n{actions};", {
      table_name: table_name,
      actions: columns.join(",\n").replace(/^/gm, '  DROP '),
    });
  },

  alterColumn: function ( table_name, column_name, options ) {
    var actions = [];
    if ( options.default === null ){
      actions.push('DROP DEFAULT');
    } else if ( options.default !== undefined ){
      actions.push('SET DEFAULT '+utils.escapeValue(options.default));
    }
    if ( options.type ){
      actions.push('SET DATA TYPE '+applyTypeAdapters(options.type));
    }
    if ( options.notNull ){
      actions.push('SET NOT NULL');
    } else if ( options.notNull === false || options.allowNull ){
      actions.push('DROP NOT NULL');
    }

    return utils.t("ALTER TABLE \"{table_name}\" \n{actions};", {
      table_name: table_name,
      actions: actions.join(",\n").replace(/^/gm, '  ALTER '+column_name+' '),
    });

  },

  // RENAME
  renameTable: function( table_name, new_name ){
    return utils.t("ALTER TABLE \"{table_name}\" RENAME TO {new_name};", {
      table_name: table_name,
      new_name: new_name
    });
  },
  undoRenameTable: function( table_name, new_name ){
    module.exports.renameTable( new_name, table_name );
  },
  renameColumn: function( table_name, column_name, new_name ){
    return utils.t("ALTER TABLE \"{table_name}\" RENAME {column} TO {new_name};", {
      table_name: table_name,
      column: column_name,
      new_name: new_name
    });
  },
  undoRenameColumn: function( table_name, column_name, new_name ){
    module.exports.renameColumn( table_name, new_name, column_name );
  },

  // CONSTRAINTS -- only supports named check constraints
  addConstraint: function( table_name, constraint_name, expression ){
    return utils.t("ALTER TABLE \"{table_name}\" ADD{constraint_name} {constraint};", {
      table_name: table_name,
      constraint_name: constraint_name ? ' CONSTRAINT '+constraint_name : '',
      constraint: expression
    });
  },
  dropConstraint: function( table_name, constraint_name, expression ){
    return utils.t("ALTER TABLE \"{table_name}\" DROP CONSTRAINT {constraint_name};", {
      table_name: table_name,
      constraint_name: constraint_name,
    });
  },


  createType: function( type_name, options ){
    return utils.t("CREATE TYPE {type_name} AS ENUM ('{opts}');", {
      type_name: type_name,
      opts: options.join("', '")
    });
  },
  dropType: function( type_name ){
    return utils.t("DROP TYPE {type_name};", { type_name: type_name });
  },
  alterType: function( type_name, options ){

  }

}

// setup reverse functions
ops.create.reverse = ops.drop;
ops.addColumns.reverse = ops.dropColumns;
ops.addConstraint.reverse = ops.dropConstraint;
ops.createType.reverse = ops.dropType;
ops.renameColumn.reverse = ops.undoRenameColumn;
ops.renameTable.reverse = ops.undoRenameTable;


var type_adapters = {
  'int': 'integer',
  'string': 'text',
  'float': 'real',
  'double': 'double precision',
  'datetime': 'timestamp',
  'bool': 'boolean',
}
function applyTypeAdapters ( type ){
  // some convenience adapters -- see above
  return type_adapters[type] ? type_adapters[type] : type;
}


function parseColumns ( columns ){
  return _.map(columns, function( options, column_name ){
    options = options || {};
    var type = applyTypeAdapters(options.type);

    var constraints = [];
    if (typeof options === 'string'){
      // convenience type for serial primary keys
      if (options == 'id'){
        type = 'serial';
        options = { primaryKey: true };
      } else {
        type = options;
      }
    }

    if (options.unique){
      constraints.push('UNIQUE');
    }
    if (options.primaryKey){
      constraints.push('PRIMARY KEY');
    }
    if (options.notNull){
      constraints.push('NOT NULL');
    }
    if (options.check){
      constraints.push('CHECK ('+options.check+')');
    }
    if (options.references){
      constraints.push('REFERENCES '+options.references);
    }

    return utils.t('\"{column_name}\" {type}{default}{constraints}', {
      column_name: column_name,
      type: type,
      default: options.default !== undefined ? ' DEFAULT '+utils.escapeValue(options.default) : '',
      constraints: constraints.length ? ' '+constraints.join(' ') : ''
    });

  }).join(", \n");
}