import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FilenameFormat } from '../../migration';
import { Migration } from '../../migration';
import { BaselineError } from '../errors';

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
export async function planBaselineFile(options: {
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
  const { dir, name, filenameFormat = 'timestamp' } = options;

  await mkdir(dir, { recursive: true });
  // Subdirectories count too: with `--use-glob`, the runner finds the
  // migrations in them.
  const files = (await readdir(dir))
    .filter((file) => !file.startsWith('.'))
    .toSorted((a, b) => a.localeCompare(b));
  if (files.length > 0) {
    throw new BaselineError(
      'MIGRATIONS_EXIST',
      `The migrations directory ${dir} already has ${files.length} file(s), starting with ${files[0]}. A baseline is the first migration, for databases without migration history: write it to an empty or new directory.`
    );
  }

  const prefix = await Migration.getFilePrefix(filenameFormat, dir);
  const migrationName = `${prefix}_${name}`;

  return { path: resolve(dir, `${migrationName}.sql`), migrationName };
}

/**
 * Writes a baseline migration file. It never overwrites: it fails when `path`
 * already exists.
 *
 * @param path Where to write.
 * @param content The migration.
 */
export async function writeBaselineFile(
  path: string,
  content: string
): Promise<void> {
  await writeFile(path, content, { flag: 'wx' });
}
