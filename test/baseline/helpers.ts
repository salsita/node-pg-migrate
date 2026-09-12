import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SanitizeOptions } from '../../src/baseline/types';

/**
 * The fixtures of the baseline unit specs: `adversarial/` and the captured
 * `dumps/`.
 */
export const BASELINE_FIXTURES_DIR = resolve(import.meta.dirname, 'fixtures');

/**
 * The PostgreSQL major versions the dumps in `fixtures/dumps` were captured
 * on.
 */
export const DUMP_MAJORS: ReadonlyArray<number> = [14, 15, 16, 17, 18];

/**
 * The schema fixtures with a captured dump on every version of
 * {@link DUMP_MAJORS}.
 */
export const DUMP_FIXTURES: ReadonlyArray<string> = [
  'pagila',
  'chinook',
  'kitchen-sink',
];

/**
 * A real `pg_dump --schema-only --no-owner --no-privileges` output from
 * `fixtures/dumps`.
 */
export interface CapturedDump {
  /**
   * `pg<major>/<fixture>`, e.g. `pg18/pagila`.
   */
  readonly name: string;

  /**
   * The major version of the server and pg_dump that made the dump.
   */
  readonly major: number;

  /**
   * The schema fixture, e.g. `pagila`.
   */
  readonly fixture: string;

  /**
   * The absolute path of the dump.
   */
  readonly path: string;

  /**
   * The dump.
   */
  readonly sql: string;
}

/**
 * Every captured dump: every fixture of {@link DUMP_FIXTURES} on every version
 * of {@link DUMP_MAJORS}.
 */
export const CAPTURED_DUMPS: ReadonlyArray<CapturedDump> = DUMP_MAJORS.flatMap(
  (major) =>
    DUMP_FIXTURES.map((fixture) => {
      const path = resolve(
        BASELINE_FIXTURES_DIR,
        'dumps',
        `pg${major}`,
        `${fixture}.sql`
      );

      return {
        name: `pg${major}/${fixture}`,
        major,
        fixture,
        path,
        sql: readFileSync(path, 'utf8'),
      };
    })
);

/**
 * The files of `fixtures/adversarial` (see its README for what each one
 * exercises).
 */
export const ADVERSARIAL_FILES: ReadonlyArray<string> = [
  'backslash-line-in-function-body.sql',
  'begin-in-atomic-body-with-data.sql',
  'begin-in-atomic-body.sql',
  'clean-dump.sql',
  'column-inserts-data.sql',
  'comment-on-extension.sql',
  'copy-data.sql',
  'create-database.sql',
  'create-schema-public.sql',
  'insert-data.sql',
  'latin1-encoding.sql',
  'marker-in-function-body.sql',
  'migrations-sequence.sql',
  'migrations-table-lookalike.sql',
  'migrations-table.sql',
  'psql-connect.sql',
  'set-role.sql',
  'set-session-authorization.sql',
  'standard-conforming-strings-off.sql',
];

/**
 * The absolute path of a file of `fixtures/adversarial`.
 *
 * @param file The file name, e.g. `copy-data.sql`.
 */
export function adversarialPath(file: string): string {
  return resolve(BASELINE_FIXTURES_DIR, 'adversarial', file);
}

/**
 * Reads a file of `fixtures/adversarial`.
 *
 * @param file The file name, e.g. `copy-data.sql`.
 */
export function readAdversarial(file: string): string {
  return readFileSync(adversarialPath(file), 'utf8');
}

/**
 * The migrations table and sequence of a default configuration:
 * `public.pgmigrations` and `public.pgmigrations_id_seq`.
 */
export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  migrationsSchema: 'public',
  migrationsTable: 'pgmigrations',
};

/**
 * Runs a function that is expected to throw and returns what it threw.
 *
 * @param fn The function.
 *
 * @returns The thrown value.
 *
 * @throws Throws an error when `fn` returns normally.
 */
export function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error('expected the function to throw, but it returned');
}

/**
 * Waits for a promise that is expected to reject and returns the reason.
 *
 * @param promise The promise.
 *
 * @returns The rejection reason.
 *
 * @throws Throws an error when `promise` resolves.
 */
export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('expected the promise to reject, but it resolved');
}

/**
 * The message of a thrown value, or its string form when it is not an error.
 *
 * @param error The thrown value.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Escapes a string for use in a regular expression.
 *
 * @param text The literal text.
 */
export function escapeRegExp(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

/**
 * Counts the non-overlapping occurrences of a literal string.
 *
 * @param text The text to search.
 * @param fragment The literal string to count.
 */
export function countOf(text: string, fragment: string): number {
  return text.split(fragment).length - 1;
}
