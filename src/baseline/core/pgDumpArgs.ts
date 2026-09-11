import type { PgDumpArgsOptions } from '../types';

/**
 * The pg_dump arguments of a baseline: a schema-only dump without owners,
 * privileges, publications, subscriptions, security labels and tablespaces,
 * with a lock wait timeout, restricted to the included schemas (plus every
 * extension, with pg_dump 14 or newer), and without the excluded schemas and
 * tables.
 *
 * The arguments never carry connection settings or credentials: pg_dump gets
 * those from its environment (see `toPgEnv()`).
 *
 * @param options What to dump.
 */
export function buildPgDumpArgs(_options: PgDumpArgsOptions): string[] {
  throw new Error('not implemented');
}
