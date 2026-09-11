import type { QualifiedName } from '../types';

/**
 * Parses a name that is optionally qualified with its schema (`name` or
 * `schema.name`, each part an unquoted or a double-quoted identifier) and
 * starts at `from` in `text`.
 *
 * @param text The text to parse, e.g. a statement of a dump.
 * @param from The offset in `text` where the name starts.
 * @returns The name as PostgreSQL stores it (see {@link QualifiedName}) and
 * `end`, the offset right after it in `text`; `undefined` when no identifier
 * starts at `from`.
 */
export function parseQualifiedName(
  _text: string,
  _from: number
): (QualifiedName & { readonly end: number }) | undefined {
  throw new Error('not implemented');
}

/**
 * Whether an identifier names the configured object, following PostgreSQL's
 * identifier rules: unquoted identifiers fold to lower case, quoted ones are
 * exact.
 *
 * @param parsed The identifier as found in SQL, e.g. `PgMigrations` (the
 * same as `pgmigrations`) or `"PgMigrations"`.
 * @param configured The configured name, e.g. the migrations table.
 */
export function identEquals(_parsed: string, _configured: string): boolean {
  throw new Error('not implemented');
}

/**
 * Turns a name into a pg_dump pattern that matches exactly that object:
 * `"schema"."name"` with every `"` in the names doubled.
 *
 * @param name The name of the object.
 */
export function toPgDumpPattern(_name: QualifiedName): string {
  throw new Error('not implemented');
}
