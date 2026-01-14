/**
 * Quote an identifier for PostgreSQL.
 *
 * Wraps the given string in double quotes and escapes any embedded double
 * quotes by doubling them, per PostgreSQL identifier rules.
 *
 * @param str - identifier to quote
 * @returns quoted identifier safe for use as a PostgreSQL identifier
 */
export function quote(str: string): string {
  return `"${str.replace(/"/g, '""')}"`;
}
