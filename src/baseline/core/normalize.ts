/**
 * The starts of the lines that differ between two dumps of the same schema:
 * the `\restrict` / `\unrestrict` lines carry a random key, and the version
 * comments name the server and pg_dump.
 */
const VOLATILE_LINE_STARTS: ReadonlyArray<string> = [
  '\\restrict ',
  '\\unrestrict ',
  '-- Dumped from database version ',
  '-- Dumped by pg_dump version ',
];

/**
 * Removes the lines of a pg_dump output that differ between two dumps of the
 * same schema: the `\restrict` / `\unrestrict` lines (which carry a random
 * key) and the `-- Dumped from database version` / `-- Dumped by pg_dump
 * version` comments.
 *
 * @param sql The pg_dump output.
 */
export function normalizeDump(sql: string): string {
  return sql
    .split('\n')
    .filter(
      (line) => !VOLATILE_LINE_STARTS.some((start) => line.startsWith(start))
    )
    .join('\n');
}
