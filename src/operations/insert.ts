import type { MigrationOptions } from '../migrationOptions';
import { escapeValue } from '../utils';
import type { Name, Value } from './generalTypes';

export type Insert = (tableName: Name, values: Record<string, Value>) => string;

export function insert(mOptions: MigrationOptions): Insert {
  return function insert(tableName, values) {
    const table = mOptions.literal(tableName);
    const entries = Object.entries(values);

    if (entries.length === 0) {
      return `INSERT INTO ${table} DEFAULT VALUES;`;
    }

    const columns = entries.map(([column]) => mOptions.literal(column));
    const row = entries.map(([, value]) => escapeValue(value));

    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${row.join(', ')});`;
  };
}
