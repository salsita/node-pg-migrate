import type { PgDumpArgsOptions } from '../types';
import { toPgDumpPattern } from './identifiers';

/**
 * The options every baseline dump starts with: the schema only, without what
 * a baseline must not set up (owners, privileges, publications,
 * subscriptions, security labels and tablespaces).
 */
const SCHEMA_ONLY_ARGS: ReadonlyArray<string> = [
  '--schema-only',
  '--no-owner',
  '--no-privileges',
  '--no-publications',
  '--no-subscriptions',
  '--no-security-labels',
  '--no-tablespaces',
];

/**
 * The first pg_dump version that knows `--extension`.
 */
const EXTENSION_OPTION_SINCE = 14;

/**
 * The pg_dump arguments of a baseline: a schema-only dump without owners,
 * privileges, publications, subscriptions, security labels and tablespaces,
 * with a lock wait timeout, restricted to the included schemas (plus every
 * extension, with pg_dump 14 or newer), and without the excluded schemas and
 * tables.
 *
 * The arguments never carry connection settings or credentials: pg_dump gets
 * those from its environment (see `toPgEnv()`). Every schema and table is
 * quoted (see `toPgDumpPattern()`), so it matches exactly one object.
 *
 * @param options What to dump.
 */
export function buildPgDumpArgs(options: PgDumpArgsOptions): string[] {
  const {
    pgDumpMajor,
    includeSchemas = [],
    excludeSchemas = [],
    excludeTables,
    lockWaitTimeout,
  } = options;
  const withExtensions =
    includeSchemas.length > 0 && pgDumpMajor >= EXTENSION_OPTION_SINCE;

  return [
    ...SCHEMA_ONLY_ARGS,
    `--lock-wait-timeout=${lockWaitTimeout}`,
    ...includeSchemas.map(
      (schema) => `--schema=${toPgDumpPattern({ name: schema })}`
    ),
    ...(withExtensions ? ['--extension=*'] : []),
    ...excludeSchemas.map(
      (schema) => `--exclude-schema=${toPgDumpPattern({ name: schema })}`
    ),
    ...excludeTables.map(
      (table) => `--exclude-table=${toPgDumpPattern(table)}`
    ),
  ];
}
