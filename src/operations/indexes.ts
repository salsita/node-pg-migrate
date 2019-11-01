import _ from 'lodash';
import { DropOptions } from '../definitions';

export interface CreateIndexOptions {
  name?: string;
  unique?: boolean;
  where?: string;
  concurrently?: boolean;
  opclass?: string;
  method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin';
}

export interface DropIndexOptionsEn {
  name?: string;
  concurrently?: boolean;
}

export type DropIndexOptions = DropIndexOptionsEn & DropOptions;

function generateIndexName(table, columns, options) {
  if (options.name) {
    return typeof table === 'object'
      ? { schema: table.schema, name: options.name }
      : options.name;
  }
  const cols = _.isArray(columns) ? columns.join('_') : columns;
  const uniq = options.unique ? '_unique' : '';
  return typeof table === 'object'
    ? {
        schema: table.schema,
        name: `${table.name}_${cols}${uniq}_index`
      }
    : `${table}_${cols}${uniq}_index`;
}

function generateColumnString(column, literal) {
  const openingBracketPos = column.indexOf('(');
  const closingBracketPos = column.indexOf(')');
  const isFunction =
    openingBracketPos >= 0 && closingBracketPos > openingBracketPos;
  return isFunction
    ? column // expression
    : literal(column); // single column
}

function generateColumnsString(columns, literal) {
  return _.isArray(columns)
    ? columns.map(column => generateColumnString(column, literal)).join(', ')
    : generateColumnString(columns, literal);
}

export function dropIndex(mOptions) {
  const _drop = (tableName, columns, options = {}) => {
    const { concurrently, ifExists, cascade } = options;
    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : '';
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const indexName = generateIndexName(tableName, columns, options);
    const cascadeStr = cascade ? ' CASCADE' : '';
    const indexNameStr = mOptions.literal(indexName);

    return `DROP INDEX${concurrentlyStr}${ifExistsStr} ${indexNameStr}${cascadeStr};`;
  };
  return _drop;
}

export function createIndex(mOptions) {
  const _create = (tableName, columns, options = {}) => {
    /*
    columns - the column, columns, or expression to create the index on

    Options
    name - explicitly specify the name for the index
    unique - is this a unique index
    where - where clause
    concurrently -
    opclass - name of an operator class
    options.method -  [ btree | hash | gist | spgist | gin ]
    */
    const indexName = generateIndexName(
      typeof tableName === 'object' ? tableName.name : tableName,
      columns,
      options
    );
    const columnsString = generateColumnsString(columns, mOptions.literal);
    const unique = options.unique ? ' UNIQUE ' : '';
    const concurrently = options.concurrently ? ' CONCURRENTLY ' : '';
    const method = options.method ? ` USING ${options.method}` : '';
    const where = options.where ? ` WHERE ${options.where}` : '';
    const opclass = options.opclass
      ? ` ${mOptions.schemalize(options.opclass)}`
      : '';
    const indexNameStr = mOptions.literal(indexName);
    const tableNameStr = mOptions.literal(tableName);

    return `CREATE ${unique} INDEX ${concurrently} ${indexNameStr} ON ${tableNameStr}${method} (${columnsString}${opclass})${where};`;
  };
  _create.reverse = dropIndex(mOptions);
  return _create;
}
