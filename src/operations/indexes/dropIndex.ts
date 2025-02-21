import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { DropOptions, Name } from '../generalTypes';
import type { IndexColumn } from './shared';
import { generateIndexName } from './shared';

export interface DropIndexOptions extends DropOptions {
  unique?: boolean;

  name?: string;

  concurrently?: boolean;
}

export type DropIndex = (
  tableName: Name,
  columns: string | Array<string | IndexColumn>,
  dropOptions?: DropIndexOptions
) => string;

export function dropIndex(mOptions: MigrationOptions): DropIndex {
  const _drop: DropIndex = (tableName, rawColumns, options = {}) => {
    const { concurrently = false, ifExists = false, cascade = false } = options;

    const columns = toArray(rawColumns);
    const concurrentlyStr = concurrently ? ' CONCURRENTLY' : '';
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const indexName = generateIndexName(
      tableName,
      columns,
      options,
      mOptions.schemalize
    );
    const cascadeStr = cascade ? ' CASCADE' : '';
    const indexNameStr = mOptions.literal(indexName);

    return `DROP INDEX${concurrentlyStr}${ifExistsStr} ${indexNameStr}${cascadeStr};`;
  };

  return _drop;
}
