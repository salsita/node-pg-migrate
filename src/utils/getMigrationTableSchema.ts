import { getSchemas } from '.';
import type { RunnerOptionConfig } from '../runner';

export function getMigrationTableSchema(
  options: Pick<RunnerOptionConfig, 'migrationsSchema' | 'schema'>
): string {
  return options.migrationsSchema === undefined
    ? getSchemas(options.schema)[0]
    : options.migrationsSchema;
}
