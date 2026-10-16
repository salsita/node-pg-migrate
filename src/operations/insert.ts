import type { MigrationOptions } from '../migrationOptions';
import { escapeValue, isPgLiteral } from '../utils';
import type { Name, Value } from './generalTypes';

export type Insert = (
  tableName: Name,
  values: Record<string, Value | undefined>
) => string;

function isSupportedValue(value: unknown): value is Value {
  if (Array.isArray(value)) {
    for (const element of value) {
      if (!isSupportedValue(element)) {
        return false;
      }
    }
    return true;
  }

  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (isPgLiteral(value) && typeof value.value === 'string')
  );
}

export function insert(mOptions: MigrationOptions): Insert {
  return function insert(tableName, values) {
    const table = mOptions.literal(tableName);
    const entries = Object.entries(values).filter(
      ([, value]) => value !== undefined
    );

    if (entries.length === 0) {
      return `INSERT INTO ${table} DEFAULT VALUES;`;
    }

    const columns = entries.map(([column]) => mOptions.literal(column));
    const rows: Array<string | number> = [];
    for (const [column, value] of entries) {
      if (!isSupportedValue(value)) {
        throw new TypeError(
          `pgm.insert(): unsupported value for ${table}.${mOptions.literal(column)}. ` +
            'Use a supported value, JSON.stringify() for JSON data, or pgm.func() / PgLiteral for explicit SQL.'
        );
      }
      rows.push(escapeValue(value));
    }

    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${rows.join(', ')});`;
  };
}
