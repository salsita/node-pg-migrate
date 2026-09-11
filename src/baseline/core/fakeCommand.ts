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
export function formatFakeCommand(
  _migrationName: string,
  _dir: string
): string {
  throw new Error('not implemented');
}
