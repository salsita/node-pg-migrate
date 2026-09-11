/**
 * Removes the lines of a pg_dump output that differ between two dumps of the
 * same schema: the `\restrict` / `\unrestrict` lines (which carry a random
 * key) and the `-- Dumped from database version` / `-- Dumped by pg_dump
 * version` comments.
 *
 * @param sql The pg_dump output.
 */
export function normalizeDump(_sql: string): string {
  throw new Error('not implemented');
}
