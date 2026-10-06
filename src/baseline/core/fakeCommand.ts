/**
 * The migrations directory node-pg-migrate uses when `-m` is not given.
 */
const DEFAULT_MIGRATIONS_DIR = 'migrations';

/**
 * The migrations table node-pg-migrate uses when `-t` is not given.
 */
const DEFAULT_MIGRATIONS_TABLE = 'pgmigrations';

/**
 * The migrations schema node-pg-migrate uses when `--migrations-schema` is not
 * given.
 */
const DEFAULT_MIGRATIONS_SCHEMA = 'public';

/**
 * Words made only of these characters mean the same to a POSIX shell with or
 * without quotes.
 */
const SHELL_SAFE = /^[\w%+,./:@-]+$/;

/**
 * Quotes a word for a POSIX shell, when it needs it: with single quotes, a
 * single quote inside written as `'\''`. Words that only have letters,
 * digits and `%+,-./:@_` stay as they are.
 *
 * @param word The word, e.g. a path.
 */
export function quoteShellWord(word: string): string {
  if (SHELL_SAFE.test(word)) {
    return word;
  }

  const escaped = word.replaceAll("'", String.raw`'\''`);
  return `'${escaped}'`;
}

/**
 * The command that records a baseline migration as run without running it:
 * `node-pg-migrate up <migrationName> --fake`, plus the options that tell
 * `up` where to write the history, so that copying the command records the
 * baseline in the same place a later `up` looks for it:
 *
 * - ` -m <dir>` when `dir` is not `migrations`;
 * - ` -t <table>` when the resolved migrations table is not `pgmigrations`;
 * - ` --migrations-schema <schema>` when the resolved migrations schema is not
 *   `public`.
 *
 * Each value is single-quoted for POSIX shells when it has spaces or shell
 * metacharacters (see {@link quoteShellWord}).
 *
 * @param migrationName The migration name (the file name without its
 * extension).
 * @param dir The migrations directory, as the user gave it.
 * @param options The resolved migrations table and schema. Left out, both
 * default, so the command is the bare `up … --fake` (plus `-m`).
 */
export function formatFakeCommand(
  migrationName: string,
  dir: string,
  options: {
    readonly migrationsTable?: string;
    readonly migrationsSchema?: string;
  } = {}
): string {
  const { migrationsTable, migrationsSchema } = options;
  const parts = [`node-pg-migrate up ${quoteShellWord(migrationName)} --fake`];

  if (dir !== DEFAULT_MIGRATIONS_DIR) {
    parts.push(`-m ${quoteShellWord(dir)}`);
  }

  if (
    migrationsTable !== undefined &&
    migrationsTable !== DEFAULT_MIGRATIONS_TABLE
  ) {
    parts.push(`-t ${quoteShellWord(migrationsTable)}`);
  }

  if (
    migrationsSchema !== undefined &&
    migrationsSchema !== DEFAULT_MIGRATIONS_SCHEMA
  ) {
    parts.push(`--migrations-schema ${quoteShellWord(migrationsSchema)}`);
  }

  return parts.join(' ');
}
