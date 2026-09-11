import type { TopLevelSegment } from '../types';

/**
 * Splits a SQL script, such as a pg_dump output, into its top-level
 * statements, psql meta-commands, `COPY` data, and the whitespace and comments
 * between them.
 *
 * The texts of the segments concatenate to the input exactly. A `;` only ends
 * a statement at the top level: not inside strings (`'…'`, `E'…'`), quoted
 * identifiers, dollar-quoted bodies or comments. A line starting with `\` is
 * a meta-command only between statements. Runs in linear time.
 *
 * @param sql The SQL script.
 * @returns The segments, in the order of the input.
 */
export function scanTopLevel(_sql: string): TopLevelSegment[] {
  throw new Error('not implemented');
}
