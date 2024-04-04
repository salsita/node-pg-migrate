import { escapeValue } from '.';

/**
 * Make a comment on a database object.
 *
 * @param object The object type.
 * @param name The object name.
 * @param text The comment text. This will be escaped. Default is `null`.
 *
 * @returns The comment SQL.
 *
 * @see https://www.postgresql.org/docs/current/sql-comment.html
 */
export function makeComment(
  object: string,
  name: string,
  text: string | null = null
): string {
  const literal = escapeValue(text);

  return `COMMENT ON ${object} ${name} IS ${literal};`;
}
