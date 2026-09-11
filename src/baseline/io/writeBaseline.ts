import type { FilenameFormat } from '../../migration';

/**
 * Picks the file of a baseline migration: creates `dir` when it is missing,
 * refuses a directory that already has files, and prefixes `name` the way
 * `node-pg-migrate create` does.
 *
 * Throws a `BaselineError` with code `MIGRATIONS_EXIST` when `dir` has any
 * file whose name does not start with a dot.
 *
 * @param options Where the migration goes and what it is called.
 * @returns The absolute path of the file and the migration name (the file
 * name without its extension).
 */
export function planBaselineFile(_options: {
  /**
   * The migrations directory.
   */
  readonly dir: string;

  /**
   * The name of the migration, after the filename prefix.
   */
  readonly name: string;

  /**
   * Prefix type of the migration filename.
   *
   * @default 'timestamp'
   */
  readonly filenameFormat?: FilenameFormat;
}): Promise<{ readonly path: string; readonly migrationName: string }> {
  return Promise.reject(new Error('not implemented'));
}

/**
 * Writes a baseline migration file. It never overwrites: it fails when `path`
 * already exists.
 *
 * @param path Where to write.
 * @param content The migration.
 */
export function writeBaselineFile(
  _path: string,
  _content: string
): Promise<void> {
  return Promise.reject(new Error('not implemented'));
}
