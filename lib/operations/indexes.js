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

function generateColumnString(column) {
  return /.+\(.*\)/.test(column)
    ? column // expression
    : template`"${column}"`; // single column
}

function generateColumnsString(columns) {
  return _.isArray(columns)
    ? columns.map(generateColumnString).join(', ')
    : generateColumnString(columns);
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

export const drop = (table_name, columns, options = {}) => {
  const {
    concurrently,
    ifExists,
    cascade,
  } = options;
  return `DROP INDEX${concurrently ? ' CONCURRENTLY' : ''}${ifExists ? ' IF EXISTS' : ''} "${generateIndexName(table_name, columns, options)}"${cascade ? ' CASCADE' : ''};`;
};

// setup reverse functions
create.reverse = drop;
