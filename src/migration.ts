import { glob } from 'glob';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { cwd } from 'node:process';
import type { QueryResult } from 'pg';
import type { DBConnection } from './db';
import type { Logger } from './logger';
import { MigrationBuilder } from './migrationBuilder';
import type { ColumnDefinitions } from './operations/tables';
import type { MigrationDirection, RunnerOption } from './runner';
import type { MigrationBuilderActions } from './sqlMigration';
import { getMigrationTableSchema } from './utils';

/*
 * A new Migration is instantiated for each migration file.
 *
 * It is responsible for storing the name of the file and knowing how to execute
 * the up and down migrations defined in the file.
 */

export type MigrationAction = (
  pgm: MigrationBuilder,
  run?: () => void
) => Promise<void> | void;

export interface RunMigration {
  readonly path: string;
  readonly name: string;
  readonly timestamp: number;
}

export const FilenameFormat = Object.freeze({
  timestamp: 'timestamp',
  utc: 'utc',
  iso: 'iso',
  index: 'index',
});

export type FilenameFormat =
  (typeof FilenameFormat)[keyof typeof FilenameFormat];

export interface CreateOptionsTemplate {
  templateFileName: string;
}

export interface CreateOptionsDefault {
  language?: 'js' | 'ts' | 'sql';
  ignorePattern?: string;
}

export type CreateOptions = {
  filenameFormat?: FilenameFormat;
  ignorePattern?: string;
} & (CreateOptionsTemplate | CreateOptionsDefault);

const SEPARATOR = '_';

function localeCompareStringsNumerically(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    usage: 'sort',
    numeric: true,
    sensitivity: 'variant',
    ignorePunctuation: true,
  });
}

function compareFileNamesByTimestamp(
  a: string,
  b: string,
  logger?: Logger
): number {
  const aTimestamp = getNumericPrefix(a, logger);
  const bTimestamp = getNumericPrefix(b, logger);

  return aTimestamp - bTimestamp;
}

interface LoadMigrationFilesOptions {
  /**
   * Regex pattern for file names to ignore (ignores files starting with `.` by default).
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `isGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `ignorePattern` as glob patterns
   */
  ignorePattern?: string | string[];
  /**
   * Use [glob](https://www.npmjs.com/package/glob) to find migration files.
   * This will use `dir` _and_ `options.ignorePattern` to glob-search for migration files.
   *
   * @default: false
   */
  useGlob?: boolean;
  /**
   * Redirect messages to this logger object, rather than `console`.
   */
  logger?: Logger;
}

/**
 * Reads files from `dir`, sorts them and returns an array of their absolute paths.
 * When not using globs, files are sorted by their numeric prefix values first.
 * 17 digit numbers are interpreted as utc date and converted to the number representation of that date.
 * Glob matches are sorted via String.localeCompare with ignored punctuation.
 *
 * @param dir The directory containing your migration files. This path is resolved from `cwd()`.
 * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
 * an array of glob patterns and set `options.useGlob = true`
 *
 * Note: enabling glob will read both, `dir` _and_ `options.ignorePattern` as glob patterns
 * @param options
 * @returns Array of absolute paths
 */
export async function getMigrationFilePaths(
  /**
   * The directory containing your migration files. This path is resolved from `cwd()`.
   * Alternatively, provide a [glob](https://www.npmjs.com/package/glob) pattern or
   * an array of glob patterns and set `options.useGlob = true`
   *
   * Note: enabling glob will read both, `dir` _and_ `options.ignorePattern` as glob patterns
   */
  dir: string | string[],
  options: LoadMigrationFilesOptions = {}
): Promise<string[]> {
  const { ignorePattern, useGlob = false, logger } = options;
  if (useGlob) {
    /**
     * By default, a `**` in a pattern will follow 1 symbolic link if
     * it is not the first item in the pattern, or none if it is the
     * first item in the pattern, following the same behavior as Bash.
     *
     * Only want files, no dirs.
     */
    const globMatches = await glob(dir, {
      ignore: ignorePattern,
      nodir: true,
      withFileTypes: true,
    });

    return globMatches
      .sort(
        (a, b) =>
          compareFileNamesByTimestamp(a.name, b.name, logger) ||
          localeCompareStringsNumerically(a.name, b.name)
      )
      .map((pathScurry) => pathScurry.fullpath());
  }

  if (Array.isArray(dir) || Array.isArray(ignorePattern)) {
    throw new TypeError(
      'Options "dir" and "ignorePattern" can only be arrays when "useGlob" is true'
    );
  }

  const ignoreRegexp = new RegExp(
    ignorePattern?.length ? `^${ignorePattern}$` : '^\\..*'
  );

  const dirContent = await readdir(`${dir}/`, { withFileTypes: true });
  return dirContent
    .filter(
      (dirent) =>
        (dirent.isFile() || dirent.isSymbolicLink()) &&
        !ignoreRegexp.test(dirent.name)
    )
    .sort(
      (a, b) =>
        compareFileNamesByTimestamp(a.name, b.name, logger) ||
        localeCompareStringsNumerically(a.name, b.name)
    )
    .map((dirent) => resolve(dir, dirent.name));
}

function getSuffixFromFileName(fileName: string): string {
  return extname(fileName).slice(1);
}

async function getLastSuffix(
  dir: string,
  ignorePattern?: string
): Promise<string | undefined> {
  try {
    const files = await getMigrationFilePaths(dir, { ignorePattern });
    return files.length > 0
      ? getSuffixFromFileName(files[files.length - 1])
      : undefined;
  } catch {
    return undefined;
  }
}

export const isoDateTimeMatch =
  /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(\.\d+)?([+-][0-2]\d:[0-5]\d|Z)?$/;

/**
 * Extracts numeric value from everything in `filename` before `SEPARATOR`.
 * 17 digit numbers are interpreted as utc date and converted to the number representation of that date.
 * Heuristics are used also to match ISO 8601 format.
 *
 * @param filename filename to extract the prefix from
 * @param logger Redirect messages to this logger object, rather than `console`.
 * @returns numeric value of the filename prefix (everything before `SEPARATOR`).
 */
export function getNumericPrefix(
  filename: string,
  logger: Logger = console
): number {
  const prefix = filename.split(SEPARATOR)[0];
  if (prefix && /^\d+$/.test(prefix)) {
    if (prefix.length === 13) {
      // timestamp: 1391877300255
      return Number(prefix);
    }

    if (prefix && prefix.length === 17) {
      // utc: 20200513070724505
      const year = prefix.slice(0, 4);
      const month = prefix.slice(4, 6);
      const date = prefix.slice(6, 8);
      const hours = prefix.slice(8, 10);
      const minutes = prefix.slice(10, 12);
      const seconds = prefix.slice(12, 14);
      const ms = prefix.slice(14, 17);
      return new Date(
        `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.${ms}Z`
      ).valueOf();
    }
  }

  if (prefix && isoDateTimeMatch.test(prefix)) {
    return new Date(prefix).valueOf();
  }

  if (prefix && /^\d{1,4$/) {
    return Number(prefix);
  }

  logger.error(`Cannot determine numeric prefix for ${prefix}`);
  return Number(prefix) || 0;
}

async function resolveSuffix(
  directory: string,
  options: CreateOptionsDefault
): Promise<string> {
  const { language, ignorePattern } = options;
  return language || (await getLastSuffix(directory, ignorePattern)) || 'js';
}

export class Migration implements RunMigration {
  /**
   * Get file prefix for a new migrations file
   *
   * @method Migration.getFilePrefix
   * @param filenameFormat Filename format
   * @param directory Migrations directory
   * @param [ignorePattern] Glob ignore pattern
   * @returns string New file prefix
   */
  static async getFilePrefix(
    filenameFormat: string,
    directory: string,
    ignorePattern?: string
  ): Promise<string> {
    if (filenameFormat === FilenameFormat.iso) {
      return new Date().toISOString();
    }

    if (filenameFormat === FilenameFormat.index) {
      const filePaths = await getMigrationFilePaths(directory, {
        ignorePattern,
        useGlob: /\*/.test(directory) || /\*/.test(ignorePattern || ''),
      });

      // Get the minimum last found prefix as the total number of matching files
      let lastPrefix = filePaths.length;

      // Index can be used only when there are no mismatching filenames, so all
      // the filenames have to be verified first against "index" naming pattern
      for (const filenamePath of filePaths) {
        const filename = basename(filenamePath);
        if (!/^\d{1,4}\D/.test(filename)) {
          throw new Error(
            `Cannot deduce index for previously created file "${filenamePath}"`
          );
        }

        lastPrefix = Math.max(lastPrefix, getNumericPrefix(filename));
      }

      // Next prefix is one more than the last found prefix
      return `${lastPrefix + 1}`.padStart(4, '0');
    }

    return filenameFormat === FilenameFormat.utc
      ? new Date().toISOString().replace(/\D/g, '')
      : Date.now().toString();
  }

  // class method that creates a new migration file by cloning the migration template
  static async create(
    name: string,
    directory: string,
    options: CreateOptions = {}
  ): Promise<string> {
    const { filenameFormat = FilenameFormat.timestamp, ignorePattern } =
      options;

    // ensure the migrations directory exists
    await mkdir(directory, { recursive: true });

    const prefix = await Migration.getFilePrefix(
      filenameFormat,
      directory,
      ignorePattern
    );

    const templateFileName =
      'templateFileName' in options
        ? resolve(cwd(), options.templateFileName)
        : join(
            import.meta.dirname,
            '..',
            '..',
            'templates',
            `migration-template.${await resolveSuffix(directory, options)}`
          );
    const suffix = getSuffixFromFileName(templateFileName);

    // file name looks like migrations/1391877300255_migration-title.js
    const newFile = join(directory, `${prefix}${SEPARATOR}${name}.${suffix}`);

    // copy the default migration template to the new file location
    await new Promise<void>((resolve, reject) => {
      createReadStream(templateFileName)
        .pipe(createWriteStream(newFile))
        .on('close', resolve)
        .on('error', reject);
    });

    return newFile;
  }

  public readonly db: DBConnection;

  public readonly path: string;

  public readonly name: string;

  public readonly timestamp: number;

  public up?: false | MigrationAction;

  public down?: false | MigrationAction;

  public readonly options: RunnerOption;

  public readonly typeShorthands?: ColumnDefinitions;

  public readonly logger: Logger;

  constructor(
    db: DBConnection,
    migrationPath: string,
    { up, down }: MigrationBuilderActions,
    options: RunnerOption,
    typeShorthands?: ColumnDefinitions,
    logger: Logger = console
  ) {
    this.db = db;
    this.path = migrationPath;
    this.name = basename(migrationPath, extname(migrationPath));
    this.timestamp = getNumericPrefix(this.name, logger);
    this.up = up;
    this.down = down;
    this.options = options;
    this.typeShorthands = typeShorthands;
    this.logger = logger;
  }

  _getMarkAsRun(action: MigrationAction): string {
    const schema = getMigrationTableSchema(this.options);

    const { migrationsTable } = this.options;
    const { name } = this;

    switch (action) {
      case this.down: {
        this.logger.info(`### MIGRATION ${this.name} (DOWN) ###`);
        return `DELETE FROM "${schema}"."${migrationsTable}" WHERE name='${name}';`;
      }

      case this.up: {
        this.logger.info(`### MIGRATION ${this.name} (UP) ###`);
        return `INSERT INTO "${schema}"."${migrationsTable}" (name, run_on) VALUES ('${name}', NOW());`;
      }

      default: {
        throw new Error('Unknown direction');
      }
    }
  }

  async _apply(
    action: MigrationAction,
    pgm: MigrationBuilder
  ): Promise<unknown> {
    if (action.length === 2) {
      await new Promise<void>((resolve) => {
        action(pgm, resolve);
      });
    } else {
      await action(pgm);
    }

    const sqlSteps = pgm.getSqlSteps();

    sqlSteps.push(this._getMarkAsRun(action));

    if (!this.options.singleTransaction && pgm.isUsingTransaction()) {
      // if not in singleTransaction mode we need to create our own transaction
      sqlSteps.unshift('BEGIN;');
      sqlSteps.push('COMMIT;');
    } else if (this.options.singleTransaction && !pgm.isUsingTransaction()) {
      // in singleTransaction mode we are already wrapped in a global transaction
      this.logger.warn('#> WARNING: Need to break single transaction! <');
      sqlSteps.unshift('COMMIT;');
      sqlSteps.push('BEGIN;');
    } else if (!this.options.singleTransaction || !pgm.isUsingTransaction()) {
      this.logger.warn(
        '#> WARNING: This migration is not wrapped in a transaction! <'
      );
    }

    if (typeof this.logger.debug === 'function') {
      this.logger.debug(`${sqlSteps.join('\n')}\n\n`);
    }

    return sqlSteps.reduce<Promise<unknown>>(
      (promise, sql) =>
        promise.then((): unknown => this.options.dryRun || this.db.query(sql)),
      Promise.resolve()
    );
  }

  _getAction(direction: MigrationDirection): MigrationAction {
    if (direction === 'down' && this.down === undefined) {
      this.down = this.up;
    }

    const action: MigrationAction | false | undefined = this[direction];

    if (action === false) {
      throw new Error(
        `User has disabled ${direction} migration on file: ${this.name}`
      );
    }

    if (typeof action !== 'function') {
      throw new Error(
        `Unknown value for direction: ${direction}. Is the migration ${this.name} exporting a '${direction}' function?`
      );
    }

    return action;
  }

  apply(direction: MigrationDirection): Promise<unknown> {
    const pgm = new MigrationBuilder(
      this.db,
      this.typeShorthands,
      Boolean(this.options.decamelize),
      this.logger
    );
    const action = this._getAction(direction);

    if (this.down === this.up) {
      // automatically infer the down migration by running the up migration in reverse mode...
      pgm.enableReverseMode();
    }

    return this._apply(action, pgm);
  }

  markAsRun(direction: MigrationDirection): Promise<QueryResult> {
    return this.db.query(this._getMarkAsRun(this._getAction(direction)));
  }
}
