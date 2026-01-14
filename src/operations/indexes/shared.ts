import type { MigrationOptions } from '../../migrationOptions';
import type { PgLiteralValue } from '../../utils';
import { isPgLiteral } from '../../utils';
import type { Literal } from '../../utils/createTransformer';
import { isNameObject, isSchemaNameObject, type Name } from '../generalTypes';
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
    return isSchemaNameObject(table)
      ? { schema: table.schema, name: options.name }
      : options.name;
  }

  const cols = columns
    .map((col, idx) => {
      if (isIndexColumn(col)) return schemalize(col.name);

      if (isPgLiteral(col)) {
        const literalValue = 'value' in col ? col.value : String(col);
        throw new Error(
          `Index name must be provided when using PgLiteral columns (column #${idx + 1}: ${literalValue})`
        );
      }

      return schemalize(col);
    })
    .join('_');
  const uniq = 'unique' in options && options.unique ? '_unique' : '';

  return isNameObject(table)
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
