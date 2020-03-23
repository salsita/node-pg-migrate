import _ from 'lodash'
import { MigrationOptions, Literal } from '../types'
import { Name } from './generalTypes'
import { DropIndex, CreateIndex, CreateIndexOptions, DropIndexOptions } from './indexesTypes'

export { CreateIndex, DropIndex }

function generateIndexName(table: Name, columns: string | string[], options: CreateIndexOptions | DropIndexOptions) {
  if (options.name) {
    return typeof table === 'object' ? { schema: table.schema, name: options.name } : options.name
  }
  const cols = _.isArray(columns) ? columns.join('_') : columns
  const uniq = 'unique' in options && options.unique ? '_unique' : ''
  return typeof table === 'object'
    ? {
        schema: table.schema,
        name: `${table.name}_${cols}${uniq}_index`,
      }
    : `${table}_${cols}${uniq}_index`
}

function generateColumnString(column: string, literal: Literal) {
  const openingBracketPos = column.indexOf('(')
  const closingBracketPos = column.indexOf(')')
  const isFunction = openingBracketPos >= 0 && closingBracketPos > openingBracketPos
  return isFunction
    ? column // expression
    : literal(column) // single column
}

function generateColumnsString(columns: string | string[], literal: Literal) {
  return _.isArray(columns)
    ? columns.map((column) => generateColumnString(column, literal)).join(', ')
    : generateColumnString(columns, literal)
}

export function dropIndex(mOptions: MigrationOptions) {
  const _drop: DropIndex = (tableName, columns, options = {}) => {
    const { concurrently, ifExists, cascade } = options
    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : ''
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const indexName = generateIndexName(tableName, columns, options)
    const cascadeStr = cascade ? ' CASCADE' : ''
    const indexNameStr = mOptions.literal(indexName)

    return `DROP INDEX${concurrentlyStr}${ifExistsStr} ${indexNameStr}${cascadeStr};`
  }
  return _drop
}

export function createIndex(mOptions: MigrationOptions) {
  const _create: CreateIndex = (tableName, columns, options = {}) => {
    /*
    columns - the column, columns, or expression to create the index on

    Options
    name - explicitly specify the name for the index
    unique - is this a unique index
    where - where clause
    concurrently -
    ifNotExists - optionally create index
    opclass - name of an operator class
    options.method -  [ btree | hash | gist | spgist | gin ]
    */
    const indexName = generateIndexName(typeof tableName === 'object' ? tableName.name : tableName, columns, options)
    const columnsString = generateColumnsString(columns, mOptions.literal)
    const unique = options.unique ? ' UNIQUE' : ''
    const concurrently = options.concurrently ? ' CONCURRENTLY' : ''
    const ifNotExistsStr = options.ifNotExists ? ' IF NOT EXISTS' : ''
    const method = options.method ? ` USING ${options.method}` : ''
    const where = options.where ? ` WHERE ${options.where}` : ''
    const opclass = options.opclass ? ` ${mOptions.schemalize(options.opclass)}` : ''
    const include = options.include
      ? ` INCLUDE (${(_.isArray(options.include) ? options.include : [options.include])
          .map(mOptions.literal)
          .join(', ')})`
      : ''
    const indexNameStr = mOptions.literal(indexName)
    const tableNameStr = mOptions.literal(tableName)

    return `CREATE${unique} INDEX${concurrently}${ifNotExistsStr} ${indexNameStr} ON ${tableNameStr}${method} (${columnsString}${opclass})${include}${where};`
  }
  _create.reverse = dropIndex(mOptions)
  return _create
}
