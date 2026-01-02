import type { MigrationOptions } from '../../migrationOptions';
import { isPgLiteral, type PgLiteralValue } from '../../utils';
import type { Literal } from '../../utils/createTransformer';
import type { Name } from '../generalTypes';
import type { CreateIndexOptions } from './createIndex';
import type { DropIndexOptions } from './dropIndex';

export interface IndexColumn {
  name: string;

  opclass?: Name;

  sort?: 'ASC' | 'DESC';
}

function isIndexColumn(col: unknown): col is IndexColumn {
  return typeof col === 'object' && col !== null && 'name' in col;
}

export function generateIndexName(
  table: Name,
  columns: Array<string | IndexColumn | PgLiteralValue>,
  options: CreateIndexOptions | DropIndexOptions,
  schemalize: Literal
): Name {
  if (options.name) {
    return typeof table === 'object' && 'schema' in table
      ? { schema: table.schema, name: options.name }
      : options.name;
  }

  const cols = columns
    .map((col) => {
      if (isIndexColumn(col)) return schemalize(col.name);

      if (isPgLiteral(col)) {
        throw new Error(
          'Index name must be provided when using PgLiteral columns'
        );
      }

      return schemalize(col);
    })
    .join('_');
  const uniq = 'unique' in options && options.unique ? '_unique' : '';

  return typeof table === 'object' && 'name' in table
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
  columns: Array<string | IndexColumn | PgLiteralValue>,
  mOptions: MigrationOptions
): string {
  return columns
    .map((column) => {
      if (isIndexColumn(column)) {
        return [
          generateColumnString(column.name, mOptions),
          column.opclass ? mOptions.literal(column.opclass) : undefined,
          column.sort,
        ]
          .filter((s) => typeof s === 'string' && s !== '')
          .join(' ');
      }

      return generateColumnString(column, mOptions);
    })
    .join(', ');
}
