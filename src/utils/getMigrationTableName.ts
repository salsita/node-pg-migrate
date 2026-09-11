import { getMigrationTableSchema, quote } from '.';
import type { RunnerOption } from '../runner';

/**
 * The quoted, schema-qualified name of the table storing which migrations have been run.
 *
 * The configured names are used exactly as given: `decamelize` applies to the names used in
 * migrations, not to where their history is kept. So every statement of a run addresses the
 * same table, in a schema spelled like the ones `CREATE SCHEMA` and `SET search_path` use.
 */
export function getMigrationTableName(
  options: RunnerOption,
  schema: string = getMigrationTableSchema(options)
): string {
  return `${quote(schema)}.${quote(options.migrationsTable)}`;
}
