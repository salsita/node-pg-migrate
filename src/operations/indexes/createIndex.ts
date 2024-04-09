import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';
import type { DropIndexOptions } from './dropIndex';
import { dropIndex } from './dropIndex';
import type { IndexColumn } from './shared';
import { generateColumnsString, generateIndexName } from './shared';

export interface CreateIndexOptions {
  name?: string;

  unique?: boolean;

  where?: string;

  concurrently?: boolean;

  ifNotExists?: boolean;

  /**
   * @deprecated should be parameter of IndexColumn
   */
  opclass?: Name;

  method?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin';

  include?: string | string[];
}

export type CreateIndexFn = (
  tableName: Name,
  columns: string | Array<string | IndexColumn>,
  options?: CreateIndexOptions & DropIndexOptions
) => string | string[];

export type CreateIndex = CreateIndexFn & { reverse: CreateIndexFn };

export function createIndex(mOptions: MigrationOptions): CreateIndex {
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
    const columns = Array.isArray(rawColumns)
      ? rawColumns.slice()
      : [rawColumns];

    if (options.opclass) {
      mOptions.logger.warn(
        "Using opclass is deprecated. You should use it as part of column definition e.g. pgm.createIndex('table', [['column', 'opclass', 'ASC']])"
      );
      const lastIndex = columns.length - 1;
      const lastColumn = columns[lastIndex];

      if (typeof lastColumn === 'string') {
        columns[lastIndex] = { name: lastColumn, opclass: options.opclass };
      } else if (lastColumn.opclass) {
        throw new Error(
          "There is already defined opclass on column, can't override it with global one"
        );
      } else {
        columns[lastIndex] = { ...lastColumn, opclass: options.opclass };
      }
    }

    const indexName = generateIndexName(
      typeof tableName === 'object' ? tableName.name : tableName,
      columns,
      options,
      mOptions.schemalize
    );
    const columnsString = generateColumnsString(columns, mOptions);
    const unique = options.unique ? ' UNIQUE' : '';
    const concurrently = options.concurrently ? ' CONCURRENTLY' : '';
    const ifNotExistsStr = options.ifNotExists ? ' IF NOT EXISTS' : '';
    const method = options.method ? ` USING ${options.method}` : '';
    const where = options.where ? ` WHERE ${options.where}` : '';
    const include = options.include
      ? ` INCLUDE (${(Array.isArray(options.include)
          ? options.include
          : [options.include]
        )
          .map(mOptions.literal)
          .join(', ')})`
      : '';
    const indexNameStr = mOptions.literal(indexName);
    const tableNameStr = mOptions.literal(tableName);

    return `CREATE${unique} INDEX${concurrently}${ifNotExistsStr} ${indexNameStr} ON ${tableNameStr}${method} (${columnsString})${include}${where};`;
  };

  _create.reverse = dropIndex(mOptions);

  return _create;
}
