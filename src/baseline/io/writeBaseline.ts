import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { FilenameFormat } from '../../migration';
import { Migration } from '../../migration';
import { BaselineError } from '../errors';

/**
 * The filename prefix `node-pg-migrate create` gives the first migration with
 * the `index` format (`Migration.getFilePrefix('index', …)` of an empty
 * directory).
 */
const FIRST_INDEX_PREFIX = '0001';

/**
 * The entries of `dir` with no leading-dot files, or `null` when `dir` does
 * not exist (which counts as empty: a refused baseline must not have created
 * it, see {@link writeBaselineFile}).
 *
 * @param dir The migrations directory.
 */
async function migrationEntries(dir: string): Promise<string[] | null> {
  try {
    return (await readdir(dir)).filter((file) => !file.startsWith('.'));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

/**
 * Picks the file of a baseline migration: refuses a directory that already
 * has files, and prefixes `name` the way `node-pg-migrate create` does. It
 * does not create `dir`: a missing one counts as empty, and
 * {@link writeBaselineFile} creates it just before the file is written, so a
 * refused baseline leaves no directory behind.
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

  /**
   * The extension of the file, which is the language of the migration.
   *
   * @default 'sql'
   */
  readonly extension?: 'sql' | 'ts' | 'js';
}): Promise<{ readonly path: string; readonly migrationName: string }> {
  const {
    dir,
    name,
    filenameFormat = 'timestamp',
    extension = 'sql',
  } = options;

  // Subdirectories count too: with `--use-glob`, the runner finds the
  // migrations in them.
  const entries = await migrationEntries(dir);
  const files = (entries ?? []).toSorted((a, b) => a.localeCompare(b));
  if (files.length > 0) {
    throw new BaselineError(
      'MIGRATIONS_EXIST',
      `The migrations directory ${dir} already has ${files.length} file(s), starting with ${files[0]}. A baseline is the first migration, for databases without migration history: write it to an empty or new directory.`
    );
  }

  // `Migration.getFilePrefix` reads `dir` only for the `index` format, where a
  // missing directory is the first migration; the timestamp and utc prefixes
  // do not touch the filesystem.
  const prefix =
    entries === null && filenameFormat === 'index'
      ? FIRST_INDEX_PREFIX
      : await Migration.getFilePrefix(filenameFormat, dir);
  const migrationName = `${prefix}_${name}`;

  return { path: resolve(dir, `${migrationName}.${extension}`), migrationName };
}

/**
 * Writes a baseline migration file, creating its parent directory when it is
 * missing (so {@link planBaselineFile} does not create it, and a refused
 * baseline leaves no directory behind). It never overwrites: it fails when
 * `path` already exists.
 *
 * @param path Where to write.
 * @param content The migration.
 */
export async function writeBaselineFile(
  path: string,
  content: string
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { flag: 'wx' });
}
