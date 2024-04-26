import type { MigrationOptions } from '../../types';
import { toArray } from '../../utils';
import type { IfNotExistsOption, Name, Reversible } from '../generalTypes';
import type { DropIndexOptions } from './dropIndex';
import { dropIndex } from './dropIndex';
import type { IndexColumn } from './shared';
import { generateColumnsString, generateIndexName } from './shared';

export interface CreateIndexOptions extends IfNotExistsOption {
  name?: string;

  unique?: boolean;

  where?: string;

  concurrently?: boolean;

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
  indexOptions?: CreateIndexOptions & DropIndexOptions
) => string;

export type CreateIndex = Reversible<CreateIndexFn>;

export function createIndex(mOptions: MigrationOptions): CreateIndex {
  const _create: CreateIndex = (tableName, rawColumns, options = {}) => {
    const {
      opclass,
      unique = false,
      concurrently = false,
      ifNotExists = false,
      method,
      where,
      include,
    } = options;

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
    const columns = toArray(rawColumns);
    if (opclass) {
      mOptions.logger.warn(
        "Using opclass is deprecated. You should use it as part of column definition e.g. pgm.createIndex('table', [['column', 'opclass', 'ASC']])"
      );
      const lastIndex = columns.length - 1;
      const lastColumn = columns[lastIndex];

      if (typeof lastColumn === 'string') {
        columns[lastIndex] = { name: lastColumn, opclass };
      } else if (lastColumn.opclass) {
        throw new Error(
          "There is already defined opclass on column, can't override it with global one"
        );
      } else {
        columns[lastIndex] = { ...lastColumn, opclass };
      }
    }

    const indexName = generateIndexName(
      typeof tableName === 'object' ? tableName.name : tableName,
      columns,
      options,
      mOptions.schemalize
    );
    const columnsString = generateColumnsString(columns, mOptions);
    const uniqueStr = unique ? ' UNIQUE' : '';
    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : '';
    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const methodStr = method ? ` USING ${method}` : '';
    const whereStr = where ? ` WHERE ${where}` : '';
    const includeStr = include
      ? ` INCLUDE (${toArray(include).map(mOptions.literal).join(', ')})`
      : '';
    const indexNameStr = mOptions.literal(indexName);
    const tableNameStr = mOptions.literal(tableName);

    return `CREATE${uniqueStr} INDEX${concurrentlyStr}${ifNotExistsStr} ${indexNameStr} ON ${tableNameStr}${methodStr} (${columnsString})${includeStr}${whereStr};`;
  };

  _create.reverse = dropIndex(mOptions);

  return _create;
}
