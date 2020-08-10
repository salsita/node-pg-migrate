import _ from 'lodash'
import { MigrationOptions, Literal } from '../types'
import { Name } from './generalTypes'
import { DropIndex, CreateIndex, CreateIndexOptions, DropIndexOptions, IndexColumn } from './indexesTypes'

export { CreateIndex, DropIndex }

function generateIndexName(
  table: Name,
  columns: (string | IndexColumn)[],
  options: CreateIndexOptions | DropIndexOptions,
  schemalize: Literal,
) {
  if (options.name) {
    return typeof table === 'object' ? { schema: table.schema, name: options.name } : options.name
  }
  const cols = columns.map((col) => schemalize(typeof col === 'string' ? col : col.name)).join('_')
  const uniq = 'unique' in options && options.unique ? '_unique' : ''
  return typeof table === 'object'
    ? {
        schema: table.schema,
        name: `${table.name}_${cols}${uniq}_index`,
      }
    : `${table}_${cols}${uniq}_index`
}

function generateColumnString(column: Name, mOptions: MigrationOptions) {
  const name = mOptions.schemalize(column)
  const isSpecial = /[. ()]/.test(name)
  return isSpecial
    ? name // expression
    : mOptions.literal(name) // single column
}

function generateColumnsString(columns: (string | IndexColumn)[], mOptions: MigrationOptions) {
  return columns
    .map((column) =>
      typeof column === 'string'
        ? generateColumnString(column, mOptions)
        : [
            generateColumnString(column.name, mOptions),
            column.opclass ? mOptions.literal(column.opclass) : undefined,
            column.sort,
          ]
            .filter((s) => typeof s === 'string' && s !== '')
            .join(' '),
    )
    .join(', ')
}

export function dropIndex(mOptions: MigrationOptions) {
  const _drop: DropIndex = (tableName, rawColumns, options = {}) => {
    const { concurrently, ifExists, cascade } = options
    const columns = _.isArray(rawColumns) ? rawColumns.slice() : [rawColumns]
    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : ''
    const ifExistsStr = ifExists ? ' IF EXISTS' : ''
    const indexName = generateIndexName(tableName, columns, options, mOptions.schemalize)
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
      if (typeof lastColumn === 'string') {
        columns[lastIndex] = { name: lastColumn, opclass: options.opclass }
      } else if (lastColumn.opclass) {
        throw new Error("There is already defined opclass on column, can't override it with global one")
      } else {
        columns[lastIndex] = { ...lastColumn, opclass: options.opclass }
      }
    }
    const indexName = generateIndexName(
      typeof tableName === 'object' ? tableName.name : tableName,
      columns,
      options,
      mOptions.schemalize,
    )
    const columnsString = generateColumnsString(columns, mOptions)
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
