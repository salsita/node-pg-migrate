import _ from 'lodash'
import { MigrationOptions, Literal } from '../types'
import { Name } from './generalTypes'
import { DropIndex, CreateIndex, CreateIndexOptions, DropIndexOptions } from './indexesTypes'

export { CreateIndex, DropIndex }

function generateIndexName(
  table: Name,
  columns: (string | string[])[],
  options: CreateIndexOptions | DropIndexOptions,
) {
  if (options.name) {
    return typeof table === 'object' ? { schema: table.schema, name: options.name } : options.name
  }
  const cols = columns.map((col) => (_.isArray(col) ? col[0] : col)).join('_')
  const uniq = 'unique' in options && options.unique ? '_unique' : ''
  return typeof table === 'object'
    ? {
        schema: table.schema,
        name: `${table.name}_${cols}${uniq}_index`,
      }
    : `${table}_${cols}${uniq}_index`
}

function generateColumnString(column: string, literal: Literal) {
  const isSpecial = /[. ()]/.test(column)
  return isSpecial
    ? column // expression
    : literal(column) // single column
}

function generateColumnsString(columns: (string | string[])[], literal: Literal) {
  return columns
    .map((column) =>
      _.isArray(column)
        ? `${generateColumnString(column[0], literal)} ${column.slice(1).join(' ')}`
        : generateColumnString(column, literal),
    )
    .join(', ')
}

export function dropIndex(mOptions: MigrationOptions) {
  const _drop: DropIndex = (tableName, rawColumns, options = {}) => {
    const { concurrently, ifExists, cascade } = options
    const columns = _.isArray(rawColumns) ? rawColumns.slice() : [rawColumns]
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
  const _create: CreateIndex = (tableName, rawColumns, options = {}) => {
    /*
    columns - the column, columns, or expression to create the index on

    Options
    name - explicitly specify the name for the index
    unique - is this a unique index
    where - where clause
    concurrently -
    ifNotExists - optionally create index
    options.method -  [ btree | hash | gist | spgist | gin ]
    */
    const columns = _.isArray(rawColumns) ? rawColumns.slice() : [rawColumns]
    if (options.opclass) {
      mOptions.logger.warn(
        "Using opclass is deprecated. You should use it as part of column definition e.g. pgm.createIndex('table', [['column', 'opclass', 'ASC']])",
      )
      const lastIndex = columns.length - 1
      const lastColumn = columns[lastIndex]
      const opclass = mOptions.schemalize(options.opclass)
      columns[lastIndex] = typeof lastColumn === 'string' ? [lastColumn, opclass] : lastColumn.splice(1, 0, opclass)
    }
    const indexName = generateIndexName(typeof tableName === 'object' ? tableName.name : tableName, columns, options)
    const columnsString = generateColumnsString(columns, mOptions.literal)
    const unique = options.unique ? ' UNIQUE' : ''
    const concurrently = options.concurrently ? ' CONCURRENTLY' : ''
    const ifNotExistsStr = options.ifNotExists ? ' IF NOT EXISTS' : ''
    const method = options.method ? ` USING ${options.method}` : ''
    const where = options.where ? ` WHERE ${options.where}` : ''
    const include = options.include
      ? ` INCLUDE (${(_.isArray(options.include) ? options.include : [options.include])
          .map(mOptions.literal)
          .join(', ')})`
      : ''
    const indexNameStr = mOptions.literal(indexName)
    const tableNameStr = mOptions.literal(tableName)

    return `CREATE${unique} INDEX${concurrently}${ifNotExistsStr} ${indexNameStr} ON ${tableNameStr}${method} (${columnsString})${include}${where};`
  }
  _create.reverse = dropIndex(mOptions)
  return _create
}
