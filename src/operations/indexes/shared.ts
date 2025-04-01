import type { MigrationOptions } from '../../migrationOptions';
import type { Literal } from '../../utils/createTransformer';
import type { Name } from '../generalTypes';
import type { CreateIndexOptions } from './createIndex';
import type { DropIndexOptions } from './dropIndex';

export interface IndexColumn {
  name: string;

  opclass?: Name;

  sort?: 'ASC' | 'DESC';
}

export function generateIndexName(
  table: Name,
  columns: Array<string | IndexColumn>,
  options: CreateIndexOptions | DropIndexOptions,
  schemalize: Literal
): Name {
  if (options.name) {
    return typeof table === 'object'
      ? { schema: table.schema, name: options.name }
      : options.name;
  }

  const cols = columns
    .map((col) => schemalize(typeof col === 'string' ? col : col.name))
    .join('_');
  const uniq = 'unique' in options && options.unique ? '_unique' : '';

  return typeof table === 'object'
    ? {
        schema: table.schema,
        name: `${table.name}_${cols}${uniq}_index`,
      }
    : `${table}_${cols}${uniq}_index`;
}

export function generateColumnString(
  column: Name,
  mOptions: MigrationOptions
): string {
  const name = mOptions.schemalize(column);
  const isSpecial = /[ ().]/.test(name);

  return isSpecial
    ? name // expression
    : mOptions.literal(name); // single column
}

export function generateColumnsString(
  columns: Array<string | IndexColumn>,
  mOptions: MigrationOptions
): string {
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
            .join(' ')
    )
    .join(', ');
}
