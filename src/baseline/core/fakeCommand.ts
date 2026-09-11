/**
 * The migrations directory node-pg-migrate uses when `-m` is not given.
 */
const DEFAULT_MIGRATIONS_DIR = 'migrations';

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
  return SHELL_SAFE.test(word)
    ? word
    : `'${word.replaceAll("'", String.raw`'\''`)}'`;
}

/**
 * The command that records a baseline migration as run without running it:
 * `node-pg-migrate up <migrationName> --fake`, plus ` -m <dir>` when `dir` is
 * not `migrations`. `dir` is single-quoted for POSIX shells when it has spaces
 * or shell metacharacters.
 *
 * @param migrationName The migration name (the file name without its
 * extension).
 * @param dir The migrations directory, as the user gave it.
 */
export function formatFakeCommand(migrationName: string, dir: string): string {
  const command = `node-pg-migrate up ${quoteShellWord(migrationName)} --fake`;

  return dir === DEFAULT_MIGRATIONS_DIR
    ? command
    : `${command} -m ${quoteShellWord(dir)}`;
}
