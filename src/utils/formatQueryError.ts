/** Lines of SQL shown on each side of the line with the error. */
const RADIUS = 10;

/** Queries with at most this many lines are shown in full. */
const MAX_LINES = 2 * RADIUS + 1;

/** An error a query failed with, like pg's `DatabaseError`. */
interface QueryError extends Error {
  /**
   * 1-based character offset of the error in the query, when PostgreSQL
   * reports one (pg passes it on as a string).
   */
  readonly position?: number | string;
}

function omitted(count: number): string {
  return `... (${count} lines omitted)`;
}

/**
 * The first lines of the query, with a line saying how many were left out.
 */
function excerpt(lines: ReadonlyArray<string>): string {
  return [
    ...lines.slice(0, MAX_LINES),
    ...(lines.length > MAX_LINES ? [omitted(lines.length - MAX_LINES)] : []),
  ].join('\n');
}

/**
 * The lines around the error, with a caret line under the one with the error
 * and a line saying how many were left out wherever lines were cut.
 */
function excerptWithCaret(
  lines: ReadonlyArray<string>,
  position: number
): string {
  const offset = position - 1;

  // The `\n` that ends a line belongs to that line, and an offset past the end
  // of the query (PostgreSQL's "at end of input") to the last one.
  let errorLine = 0;
  let lineStart = 0;
  while (
    errorLine < lines.length - 1 &&
    lineStart + lines[errorLine].length < offset
  ) {
    lineStart += lines[errorLine].length + 1;
    errorLine += 1;
  }

  const isLong = lines.length > MAX_LINES;
  const start = isLong ? Math.max(0, errorLine - RADIUS) : 0;
  const end = isLong
    ? Math.min(lines.length, errorLine + RADIUS + 1)
    : lines.length;

  return [
    ...(start > 0 ? [omitted(start)] : []),
    ...lines.slice(start, errorLine + 1),
    `${' '.repeat(offset - lineStart)}^^^^`,
    ...lines.slice(errorLine + 1, end),
    ...(end < lines.length ? [omitted(lines.length - end)] : []),
  ].join('\n');
}

/**
 * Formats what is logged when a query fails: the SQL, with a caret under the
 * error when PostgreSQL reports its position, followed by the error.
 *
 * A query of more than 21 lines is cut down to the 10 lines on each side of
 * the line with the error, or to its first 21 lines when there is no
 * position, with a `... (N lines omitted)` line for each cut. Otherwise a
 * failed migration with thousands of statements floods the log with all of
 * them.
 *
 * Only `\n` separates lines: a `\r` before it stays part of the line, as it is
 * in the query.
 *
 * @param sql The text of the query that failed, `undefined` when pg ran a
 * prepared statement by its name alone.
 * @param error The error the query failed with.
 * @returns The text to log.
 */
export function formatQueryError(
  sql: string | undefined,
  error: QueryError
): string {
  const lines = String(sql).split('\n');
  const position = Number(error.position);

  if (error.message && position >= 1) {
    return `Error executing:
${excerptWithCaret(lines, position)}

${error.message}
`;
  }

  return `Error executing:
${excerpt(lines)}
${error}
`;
}
