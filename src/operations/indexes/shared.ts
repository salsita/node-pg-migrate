import type { MigrationOptions } from '../../migrationOptions';
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

function isIndexColumn(value: unknown): value is IndexColumn {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

export function generateIndexName(
  table: Name,
  columns: Array<string | IndexColumn>,
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
  if (isPgLiteral(column)) {
    return column.toString();
  }

  const name = mOptions.schemalize(column);
  const isExpression = /[^\w".]/.test(name);
  if (!isExpression) {
    return mOptions.literal(name);
  }

  // Expressions need parentheses in index definitions, unless they're already
  // wrapped (we consider any expression ending with ')' as already wrapped).
  const alreadyWrapped = /\)$/.test(name);
  return alreadyWrapped ? name : `(${name})`;
}

export function generateColumnsString(
  columns: Array<string | IndexColumn>,
  mOptions: MigrationOptions
): string {
  return columns
    .map((column) => {
      if (typeof column === 'string' || isPgLiteral(column)) {
        return generateColumnString(column as unknown as Name, mOptions);
      }

      return [
        generateColumnString(column.name, mOptions),
        column.opclass ? mOptions.literal(column.opclass) : undefined,
        column.sort,
      ]
        .filter((s) => typeof s === 'string' && s !== '')
        .join(' ');
    })
    .join(', ');
}
