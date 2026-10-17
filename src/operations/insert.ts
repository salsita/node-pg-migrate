import type { MigrationOptions } from '../migrationOptions';
import { escapeValue, isPgLiteral } from '../utils';
import type { Name, Value } from './generalTypes';

export type Insert = (
  tableName: Name,
  values:
    | Record<string, Value | undefined>
    | Array<Record<string, Value | undefined>>
) => string | string[];

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
    const records = (Array.isArray(values) ? values : [values]).map(
      (record) =>
        new Map(
          Object.entries(record).filter(([, value]) => value !== undefined)
        )
    );
    if (records.length === 0) {
      return [];
    }

    const columns = [
      ...new Set(records.flatMap((record) => [...record.keys()])),
    ];
    if (columns.length === 0) {
      return records
        .map(() => `INSERT INTO ${table} DEFAULT VALUES;`)
        .join('\n');
    }

    const rows: string[] = [];
    for (const record of records) {
      const row: Array<string | number> = [];
      for (const column of columns) {
        const value = record.get(column);
        if (value === undefined) {
          row.push('DEFAULT');
        } else {
          if (!isSupportedValue(value)) {
            throw new TypeError(
              `pgm.insert(): unsupported value for ${table}.${mOptions.literal(column)}. ` +
                'Use a supported value, JSON.stringify() for JSON data, or pgm.func() / PgLiteral for explicit SQL.'
            );
          }
          row.push(escapeValue(value));
        }
      }
      rows.push(`(${row.join(', ')})`);
    }

    return `INSERT INTO ${table} (${columns.map((column) => mOptions.literal(column)).join(', ')}) VALUES ${rows.join(', ')};`;
  };
}
