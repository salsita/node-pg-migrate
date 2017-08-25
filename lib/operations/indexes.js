import _ from 'lodash';
import { template } from '../utils';

function generateIndexName(table, columns, options) {
  const table_name = typeof table === 'object'
    ? table.name
    : table;
  return options.name
    ? options.name
    : template`${table_name}_${_.isArray(columns) ? columns.join('_') : columns}${options.unique ? '_unique' : ''}_index`;
}

function generateColumnsString(columns) {
  if (_.isArray(columns)) {
    return columns.map(name => template`"${name}"`).join(', ');
  }
  if (/.+\(.*\)/.test(columns)) { // expression
    return columns;
  }
  return template`"${columns}"`; // single column
}

export const create = (table_name, columns, options = {}) => {
  /*
   columns - the column, columns, or expression to create the index on

   Options
   name - explicitly specify the name for the index
   unique - is this a unique index
   where - where clause
   concurrently -
   options.method -  [ btree | hash | gist | spgist | gin ]
   */
  const indexName = generateIndexName(table_name, columns, options);
  const columnsString = generateColumnsString(columns);
  const unique = options.unique ? ' UNIQUE ' : '';
  const concurrently = options.concurrently ? ' CONCURRENTLY ' : '';
  const method = options.method ? ` USING ${options.method}` : '';
  const where = options.where ? ` WHERE ${options.where}` : '';

  return template`CREATE ${unique} INDEX ${concurrently} "${indexName}" ON "${table_name}"${method} (${columnsString})${where};`;
};

export const drop = (table_name, columns, options = {}) => `DROP INDEX "${generateIndexName(table_name, columns, options)}";`;

// setup reverse functions
create.reverse = drop;
