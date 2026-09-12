/**
 * Why `baseline()` refused to write a baseline migration.
 *
 * - `INVALID_OPTIONS`: the options are incomplete or contradict each other.
 * - `MIGRATIONS_EXIST`: the migrations directory already has files.
 * - `HISTORY_EXISTS`: the migrations table already records migrations.
 * - `UNSUPPORTED_SERVER`: the server is not PostgreSQL (e.g. CockroachDB).
 * - `BINARY_DUMP`: the dump is not SQL text, but a pg_dump custom- or
 *   tar-format archive (`pg_dump -Fc`/`-Ft`), a compressed file or UTF-16
 *   text.
 * - `NON_STANDARD_STRINGS`: the dump was made with
 *   `standard_conforming_strings` off, so the backslashes in its strings are
 *   escapes, but a migration is read before its `SET` can take effect (make
 *   it with `PGOPTIONS='-c standard_conforming_strings=on'`).
 * - `PSQL_META_COMMAND`: the dump has a psql meta-command such as `\connect`.
 * - `DATA_IN_DUMP`: the dump has table data (`COPY … FROM stdin` or
 *   `INSERT`) or the values of sequences (`setval()`).
 * - `CREATE_DATABASE`: the dump creates a database (`pg_dump --create`).
 * - `CLEAN_DUMP`: the dump drops objects (`pg_dump --clean`).
 * - `SET_ROLE_IN_DUMP`: the dump changes the role that runs the migration
 *   (`SET ROLE`, `SET SESSION AUTHORIZATION` or their `RESET`), as pg_dump
 *   `--use-set-session-authorization` does without `--no-owner`, and
 *   pg_restore `--role`.
 * - `MIGRATIONS_TABLE_IN_DUMP`: the dump creates the migrations table or its
 *   sequence.
 * - `MARKER_COLLISION`: a line of the dump would be read as an up/down
 *   migration marker.
 * - `PG_DUMP_NOT_FOUND`: the pg_dump executable could not be found.
 * - `PG_DUMP_TOO_OLD`: pg_dump is older than the server it would dump.
 * - `PG_DUMP_FAILED`: pg_dump failed, or its version could not be read.
 * - `UNSUPPORTED_OBJECTS`: a TypeScript/JavaScript baseline (`format` `ts` or
 *   `js`) cannot represent some objects of the database, or, with `strict`,
 *   would need raw SQL for some; the message lists them and why.
 */
export type BaselineErrorCode =
  | 'INVALID_OPTIONS'
  | 'MIGRATIONS_EXIST'
  | 'HISTORY_EXISTS'
  | 'UNSUPPORTED_SERVER'
  | 'BINARY_DUMP'
  | 'NON_STANDARD_STRINGS'
  | 'PSQL_META_COMMAND'
  | 'DATA_IN_DUMP'
  | 'CREATE_DATABASE'
  | 'CLEAN_DUMP'
  | 'SET_ROLE_IN_DUMP'
  | 'MIGRATIONS_TABLE_IN_DUMP'
  | 'MARKER_COLLISION'
  | 'PG_DUMP_NOT_FOUND'
  | 'PG_DUMP_TOO_OLD'
  | 'PG_DUMP_FAILED'
  | 'UNSUPPORTED_OBJECTS';

/**
 * An expected failure of `baseline()`: the options, the database or the dump
 * are not suitable for a baseline migration.
 *
 * The message is written for the user (it says what is wrong and what to do
 * about it), so the CLI prints nothing else.
 */
export class BaselineError extends Error {
  override readonly name = 'BaselineError';

  /**
   * What went wrong, for programmatic handling.
   */
  readonly code: BaselineErrorCode;

  /**
   * @param code What went wrong.
   * @param message What is wrong and what to do about it, for the user.
   * @param options The underlying error as `cause`, if any.
   */
  constructor(
    code: BaselineErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.code = code;
  }
}
