import { tsString } from '../literals';
import type { Emitted } from '../types';

/**
 * The code that runs raw SQL: `pgm.sql(<sql as tsString()>);`.
 *
 * @param sql One or more SQL statements.
 */
export function sqlStatement(sql: string): string {
  return `pgm.sql(${tsString(sql)});`;
}

/**
 * A fallback step that runs raw SQL: `pgm.sql(<sql as tsString()>);`.
 *
 * `pgm.sql()` is called without its template arguments, so `{…}` in the SQL
 * stays as it is.
 *
 * @param sql One or more SQL statements.
 * @param reason Why the object needs raw SQL.
 */
export function emitFallback(sql: string, reason: string): Emitted {
  return { kind: 'fallback', code: sqlStatement(sql), reason };
}

/**
 * A step made of `pgm` calls (`code`), followed by raw SQL statements, each
 * with its own `pgm.sql()` call: a fallback for `reasons` (joined with `', '`)
 * when there are any, else plain code.
 *
 * @param code The `pgm` calls, possibly none (`''`).
 * @param statements The SQL statements that follow them.
 * @param reasons Why the object needs raw SQL, in the order the emitter's
 * JSDoc lists them.
 */
export function withStatements(
  code: string,
  statements: ReadonlyArray<string>,
  reasons: ReadonlyArray<string>
): Emitted {
  const lines = [
    ...(code === '' ? [] : [code]),
    ...statements.map(sqlStatement),
  ];

  return reasons.length === 0
    ? { kind: 'code', code: lines.join('\n') }
    : { kind: 'fallback', code: lines.join('\n'), reason: reasons.join(', ') };
}
