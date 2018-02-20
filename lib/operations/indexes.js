import _ from 'lodash';
import { template, haveBrackets } from '../utils';

function generateIndexName(table, columns, options) {
  const tableName = typeof table === 'object'
    ? table.name
    : table;
  return options.name
    ? options.name
    : template`${tableName}_${_.isArray(columns) ? columns.join('_') : columns}${options.unique ? '_unique' : ''}_index`;
}

function generateColumnString(column) {
  const isFunction = haveBrackets(column);
  return isFunction
    ? column // expression
    : template`"${column}"`; // single column
}

function generateColumnsString(columns) {
  return _.isArray(columns)
    ? columns.map(generateColumnString).join(', ')
    : generateColumnString(columns);
}

export const create = (tableName, columns, options = {}) => {
  /*
   columns - the column, columns, or expression to create the index on

   Options
   name - explicitly specify the name for the index
   unique - is this a unique index
   where - where clause
   concurrently -
   options.method -  [ btree | hash | gist | spgist | gin ]
   */
  const indexName = generateIndexName(tableName, columns, options);
  const columnsString = generateColumnsString(columns);
  const unique = options.unique ? ' UNIQUE ' : '';
  const concurrently = options.concurrently ? ' CONCURRENTLY ' : '';
  const method = options.method ? ` USING ${options.method}` : '';
  const where = options.where ? ` WHERE ${options.where}` : '';

  return template`CREATE ${unique} INDEX ${concurrently} "${indexName}" ON "${tableName}"${method} (${columnsString})${where};`;
};

export const drop = (tableName, columns, options = {}) => {
  const {
    concurrently,
    ifExists,
    cascade,
  } = options;
  return `DROP INDEX${concurrently ? ' CONCURRENTLY' : ''}${ifExists ? ' IF EXISTS' : ''} "${generateIndexName(tableName, columns, options)}"${cascade ? ' CASCADE' : ''};`;
};

// setup reverse functions
create.reverse = drop;
