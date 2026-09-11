import type { Emitted } from '../types';

/**
 * A fallback step that runs raw SQL: `pgm.sql(<sql as tsString()>);`.
 *
 * `pgm.sql()` is called without its template arguments, so `{…}` in the SQL
 * stays as it is.
 *
 * @param sql One or more SQL statements.
 * @param reason Why the object needs raw SQL.
 */
export function emitFallback(_sql: string, _reason: string): Emitted {
  throw new Error('not implemented');
}
