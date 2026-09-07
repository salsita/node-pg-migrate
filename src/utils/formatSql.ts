/**
 * Separator that joins a SQL statement header (e.g. `ALTER TABLE "x"`) to its
 * clause body.
 *
 * In pretty mode the body starts on a new line, indented by `indent`; in
 * single-line mode a plain space is used.
 *
 * @param pretty Whether to format across multiple lines.
 * @param indent Indentation prepended after the linebreak in pretty mode.
 */
export function formatSeparator(pretty: boolean, indent = ''): string {
  return pretty ? `\n${indent}` : ' ';
}

/**
 * Wraps the body of a parenthesized definition (e.g. the columns of a
 * `CREATE TABLE (...)`).
 *
 * In pretty mode the body is surrounded by linebreaks so it sits on its own
 * lines; in single-line mode it is returned unchanged so it stays inline within
 * the parentheses.
 *
 * @param body The already-formatted body.
 * @param pretty Whether to format across multiple lines.
 */
export function formatBlock(body: string, pretty: boolean): string {
  return pretty ? `\n${body}\n` : body;
}
