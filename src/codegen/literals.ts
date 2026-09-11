/**
 * Writes a string as a JavaScript string literal that evaluates to exactly
 * `value`, in single quotes: backslashes, single quotes, line terminators
 * (`\n`, `\r`, U+2028, U+2029) and other control characters are escaped, so
 * the literal is valid TypeScript and JavaScript on one line. The same value
 * always gives the same literal.
 *
 * @param value The string, e.g. SQL for `pgm.sql()` or an expression for
 * `pgm.func()`.
 * @returns The literal, e.g. `'it\'s'`.
 */
export function tsString(_value: string): string {
  throw new Error('not implemented');
}
