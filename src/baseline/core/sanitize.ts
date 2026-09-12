import { BaselineError } from '../errors';
import type {
  DumpStats,
  QualifiedName,
  SanitizedDump,
  SanitizeOptions,
  SegmentKind,
  TopLevelSegment,
} from '../types';
import { quoteShellWord } from './fakeCommand';
import {
  identEquals,
  parseQualifiedName,
  toPgDumpPattern,
} from './identifiers';
import { codeAt, foldIdentifier, isSpace, skipWhile } from './lexer';
import type { MarkerMatch } from './markers';
import { findMigrationMarker } from './markers';
import { copiesFromStdin, scanTopLevel } from './scan';
import { Statement } from './statement';

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/**
 * The characters that can follow a statement before the line break that
 * ends its line: spaces, tabs and the `\r` of a `\r\n`.
 */
const LINE_END_BLANKS: ReadonlySet<number> = new Set([
  0x20,
  0x09,
  CARRIAGE_RETURN,
]);

/**
 * How much of a line error messages quote.
 */
const EXCERPT_LENGTH = 120;

/**
 * The cleaned-up SQL as it is written: pieces of the dump and new text. It
 * remembers where the copied pieces come from, for the line numbers of error
 * messages about the output.
 */
class SqlWriter {
  readonly #dump: string;

  readonly #parts: string[] = [];

  #length = 0;

  /**
   * The offset in the output of each piece copied from the dump.
   */
  readonly #copyStarts: number[] = [];

  /**
   * The offset in the dump of each piece copied from the dump.
   */
  readonly #copySources: number[] = [];

  /**
   * @param dump The dump the pieces are copied from.
   */
  constructor(dump: string) {
    this.#dump = dump;
  }

  /**
   * Copies `from`…`to` of the dump.
   */
  keep(from: number, to: number): void {
    if (to > from) {
      this.#copyStarts.push(this.#length);
      this.#copySources.push(from);
      this.#append(this.#dump.slice(from, to));
    }
  }

  /**
   * Writes new text.
   */
  write(text: string): void {
    this.#append(text);
  }

  /**
   * The offset in the dump of the character at `offset` of the output, which
   * must come from a copied piece.
   */
  sourceOffset(offset: number): number {
    const piece = this.#copyStarts.findLastIndex((start) => start <= offset);

    return this.#copySources[piece] + offset - this.#copyStarts[piece];
  }

  /**
   * Everything written so far.
   */
  toString(): string {
    return this.#parts.join('');
  }

  #append(text: string): void {
    this.#parts.push(text);
    this.#length += text.length;
  }
}

/**
 * The state of the cleanup of one dump.
 */
interface Context {
  readonly dump: string;
  readonly output: SqlWriter;

  /**
   * The migrations table, which the dump must not create.
   */
  readonly migrationsTable: Required<QualifiedName>;

  /**
   * The sequence of the migrations table, which the dump must not create.
   */
  readonly migrationsSequence: Required<QualifiedName>;

  /**
   * The schemas node-pg-migrate may create before the baseline runs (R8c).
   */
  readonly createdSchemas: ReadonlyArray<string>;

  /**
   * The settings saved before their first `SET LOCAL`, in first-seen order
   * (R6).
   */
  readonly settings: Set<string>;

  readonly stats: { -readonly [Key in keyof DumpStats]: number };

  readonly source: { serverVersion?: string; pgDumpVersion?: string };

  /**
   * The `\restrict` key, once the `\restrict` line is dropped, and whether
   * its `\unrestrict` line is still to come (R1).
   */
  restrict: { readonly key: string; open: boolean } | undefined;

  /**
   * Whitespace before this offset is dropped with the statement before it.
   */
  keepFrom: number;
}

/**
 * The first line of a text, trimmed and cut to {@link EXCERPT_LENGTH}.
 */
function excerpt(text: string): string {
  const newline = text.search(/[\n\r]/);
  const line = (newline === -1 ? text : text.slice(0, newline)).trim();

  return line.length > EXCERPT_LENGTH
    ? `${line.slice(0, EXCERPT_LENGTH)}…`
    : line;
}

/**
 * The 1-based line of an offset.
 */
function lineOf(text: string, offset: number): number {
  let line = 1;
  let newline = text.indexOf('\n');
  while (newline !== -1 && newline < offset) {
    line += 1;
    newline = text.indexOf('\n', newline + 1);
  }

  return line;
}

/**
 * The offset right after the line break that follows `end` when only spaces
 * and tabs are in between and the text from `start` to `end` starts a line;
 * `end` otherwise. Dropping a statement that is alone on its line then drops
 * the whole line.
 */
function lineRestEnd(dump: string, start: number, end: number): number {
  if (start > 0 && codeAt(dump, start - 1) !== LINE_FEED) {
    return end;
  }

  let index = end;
  while (LINE_END_BLANKS.has(codeAt(dump, index))) {
    index += 1;
  }

  return codeAt(dump, index) === LINE_FEED ? index + 1 : end;
}

/**
 * Leaves a statement out of the output.
 */
function drop(statement: Statement, context: Context): true {
  context.keepFrom = lineRestEnd(context.dump, statement.start, statement.end);

  return true;
}

/**
 * Copies a segment to the output as it is.
 */
function keepSegment(segment: TopLevelSegment, context: Context): void {
  context.output.keep(segment.start, segment.start + segment.text.length);
}

/**
 * The statement that saves the value a setting has before the baseline
 * changes it (R6).
 */
function saveOf(name: string): string {
  return `SELECT pg_catalog.set_config('node_pg_migrate.${name}', pg_catalog.current_setting('${name}'), true);`;
}

/**
 * The statement that gives a setting back the value it had before the
 * baseline (R6).
 */
function restoreOf(name: string): string {
  return `SELECT pg_catalog.set_config('${name}', pg_catalog.current_setting('node_pg_migrate.${name}'), true);`;
}

/**
 * Whether the token at `index` is an identifier that names `schema`.
 */
function namesSchema(
  statement: Statement,
  index: number,
  schema: string
): boolean {
  const token = statement.token(index);

  return (
    (token?.kind === 'word' || token?.kind === 'quoted') &&
    identEquals(token.text, schema)
  );
}

/**
 * The index of the schema name in `CREATE SCHEMA [IF NOT EXISTS] <name>`;
 * `-1` for any other statement.
 */
function createdSchemaIndex(statement: Statement): number {
  if (!statement.hasWords(0, ['create', 'schema'])) {
    return -1;
  }

  return statement.hasWords(2, ['if', 'not', 'exists']) ? 5 : 2;
}

/**
 * What a `CREATE [UNLOGGED] TABLE|SEQUENCE [IF NOT EXISTS] <name>` statement
 * creates; `undefined` for any other statement.
 */
function createdRelation(
  statement: Statement
): { readonly kind: string; readonly name: QualifiedName } | undefined {
  const kindIndex = statement.word(1) === 'unlogged' ? 2 : 1;
  const kind = statement.word(kindIndex);
  if (
    statement.word(0) !== 'create' ||
    (kind !== 'table' && kind !== 'sequence')
  ) {
    return undefined;
  }

  const nameIndex =
    kindIndex +
    (statement.hasWords(kindIndex + 1, ['if', 'not', 'exists']) ? 4 : 1);
  const token = statement.token(nameIndex);
  const name =
    token === undefined
      ? undefined
      : parseQualifiedName(statement.text, token.start);

  return name === undefined ? undefined : { kind, name };
}

/**
 * A step of the cleanup of a statement. It returns `true` when it took care
 * of the statement (dropped or rewrote it), `false` to leave it to the next
 * step, and throws when the statement cannot be in a baseline. A statement
 * that no step takes is kept as it is.
 */
type StatementRule = (statement: Statement, context: Context) => boolean;

/**
 * The index of the function name in `SELECT <name>…` or
 * `SELECT pg_catalog.<name>…`; `-1` for any other statement.
 */
function selectedFunction(statement: Statement, name: string): number {
  const call = statement.word(1) === 'pg_catalog' ? 3 : 1;
  const selects =
    statement.word(0) === 'select' &&
    (call === 1 || statement.token(2)?.text === '.') &&
    statement.word(call) === name;

  return selects ? call : -1;
}

/**
 * The error for a statement that means the dump has data (R2).
 *
 * @param what What the statement does, e.g. `has table data`.
 * @param options The pg_dump options to make the dump with.
 */
function dataInDump(
  statement: Statement,
  what: string,
  options: string
): BaselineError {
  return new BaselineError(
    'DATA_IN_DUMP',
    `line ${statement.line}: the dump ${what} (\`${excerpt(statement.text)}\`), but a baseline only creates the schema. Make the dump with ${options}.`
  );
}

/**
 * R2: `COPY … FROM stdin` and `INSERT` (pg_dump `--inserts` and
 * `--column-inserts`) mean the dump has table data, and `setval()` that it
 * has the values of sequences, which blank databases start from their start
 * value. A schema-only dump has none of them.
 */
function refuseData(statement: Statement): boolean {
  const first = statement.word(0);
  if (
    first === 'insert' ||
    (first === 'copy' && copiesFromStdin(statement.text))
  ) {
    throw dataInDump(statement, 'has table data', '--schema-only');
  }

  const setval = selectedFunction(statement, 'setval');
  if (setval !== -1 && statement.token(setval + 1)?.text === '(') {
    throw dataInDump(
      statement,
      'sets the value of a sequence',
      '--schema-only, and without --sequence-data'
    );
  }

  return false;
}

/**
 * R3: a baseline runs in the database it is recorded in.
 */
function refuseCreateDatabase(statement: Statement): boolean {
  if (statement.hasWords(0, ['create', 'database'])) {
    throw new BaselineError(
      'CREATE_DATABASE',
      `line ${statement.line}: the dump creates a database (\`${excerpt(statement.text)}\`), but a baseline runs in the database it is recorded in. Make the dump without --create.`
    );
  }

  return false;
}

/**
 * R4: a baseline only creates objects.
 */
function refuseDrop(statement: Statement): boolean {
  if (statement.word(0) === 'drop') {
    throw new BaselineError(
      'CLEAN_DUMP',
      `line ${statement.line}: the dump drops objects (\`${excerpt(statement.text)}\`), but a baseline only creates them. Make the dump without --clean.`
    );
  }

  return false;
}

/**
 * R9: node-pg-migrate creates its migrations table (and its sequence)
 * itself, before it runs any migration.
 */
function refuseMigrationsTable(
  statement: Statement,
  context: Context
): boolean {
  const created = createdRelation(statement);
  if (created === undefined) {
    return false;
  }

  const { schema, name } =
    created.kind === 'table'
      ? context.migrationsTable
      : context.migrationsSequence;
  if (created.name.schema === schema && created.name.name === name) {
    const pattern = toPgDumpPattern({ schema, name });
    throw new BaselineError(
      'MIGRATIONS_TABLE_IN_DUMP',
      `line ${statement.line}: the dump creates the migrations ${created.kind} ${pattern}, which node-pg-migrate creates itself. Exclude it from the dump: pg_dump --exclude-table=${quoteShellWord(pattern)}.`
    );
  }

  return false;
}

/**
 * The tokens of `set_config('search_path', '', false)` after `set_config`,
 * folded to lower case.
 */
const SEARCH_PATH_RESET: ReadonlyArray<string> = [
  '(',
  "'search_path'",
  ',',
  "''",
  ',',
  'false',
  ')',
];

/**
 * R5: pg_dump empties the search path, which would break the migrations that
 * run after the baseline in the same transaction.
 */
function dropSearchPathReset(statement: Statement, context: Context): boolean {
  const call = selectedFunction(statement, 'set_config');
  const isReset =
    call !== -1 &&
    SEARCH_PATH_RESET.every(
      (text, offset) =>
        foldIdentifier(statement.token(call + 1 + offset)?.text ?? '') === text
    ) &&
    statement.endsAt(call + 1 + SEARCH_PATH_RESET.length);

  return isReset && drop(statement, context);
}

/**
 * The scopes that `SET` keeps as they are: `SET LOCAL` already only lasts
 * for the transaction, and `SET SESSION` is not a plain setting.
 */
const SET_SCOPES: ReadonlySet<string> = new Set(['local', 'session']);

/**
 * The settings behind `SET ROLE` and `SET SESSION AUTHORIZATION`, which can
 * also be set and reset by name.
 */
const ROLE_SETTINGS: ReadonlySet<string> = new Set([
  'role',
  'session_authorization',
]);

/**
 * Whether the tokens from `index` on name a setting of the role:
 * `ROLE`, `SESSION AUTHORIZATION`, `role` or `session_authorization`.
 */
function namesRole(statement: Statement, index: number): boolean {
  const name = statement.word(index);

  return (
    (name !== undefined && ROLE_SETTINGS.has(name)) ||
    statement.hasWords(index, ['session', 'authorization'])
  );
}

/**
 * R6b: `SET [SESSION|LOCAL] ROLE …`, `SET [SESSION|LOCAL] SESSION
 * AUTHORIZATION …` and their `RESET` change the role that runs the baseline,
 * and the role would stay changed after it: for the insert into the
 * migrations table, and for the migrations after the baseline. pg_dump
 * writes them with `--use-set-session-authorization` but without
 * `--no-owner`, and pg_restore with `--role`.
 */
function refuseRoleChange(statement: Statement): boolean {
  const keyword = statement.word(0);
  const scoped = keyword === 'set' && SET_SCOPES.has(statement.word(1) ?? '');
  if (
    (keyword === 'set' || keyword === 'reset') &&
    (namesRole(statement, 1) || (scoped && namesRole(statement, 2)))
  ) {
    throw new BaselineError(
      'SET_ROLE_IN_DUMP',
      `line ${statement.line}: the dump changes the role that runs the migration (\`${excerpt(statement.text)}\`), which would also run the migrations after the baseline as that role. Make the dump with --no-owner, and without pg_restore's --role.`
    );
  }

  return false;
}

/**
 * What a `SET <name> = <value>` or `SET <name> TO <value>` statement changes
 * for the session: the setting, folded to lower case, and the offset in the
 * statement right after `SET`. `undefined` for any other statement.
 */
function sessionSetting(
  statement: Statement
): { readonly name: string; readonly afterSet: number } | undefined {
  const keyword = statement.token(0);
  const name = statement.word(1);
  const operator = statement.token(2)?.folded;
  if (
    keyword?.folded !== 'set' ||
    name === undefined ||
    SET_SCOPES.has(name) ||
    (operator !== '=' && operator !== 'to')
  ) {
    return undefined;
  }

  return { name, afterSet: keyword.end };
}

/**
 * The quotes around a string (`'…'`) and a quoted identifier (`"…"`).
 */
const QUOTES: ReadonlySet<string> = new Set(["'", '"']);

/**
 * The value a `SET <name> = <value>` statement gives its setting: a word or
 * a number as it is written, or the text of a `'…'` string or a `"…"`
 * identifier, with its doubled quotes undoubled. `undefined` for `DEFAULT`
 * and for values written any other way (e.g. `E'…'`).
 */
function settingValue(statement: Statement): string | undefined {
  const token = statement.token(3);
  if (token === undefined || token.folded === 'default') {
    return undefined;
  }

  if (token.kind === 'word' || token.kind === 'number') {
    return token.text;
  }

  const quote = token.text.charAt(0);

  return QUOTES.has(quote)
    ? token.text.slice(1, -1).replaceAll(quote.repeat(2), quote)
    : undefined;
}

/**
 * The values PostgreSQL reads as the boolean false, in lower case: `false`,
 * `no` and `off`, which it also takes cut short as long as no word for true
 * starts the same way (`of`, but not `o`), and `0`.
 */
const FALSE_VALUES: ReadonlySet<string> = new Set([
  'f',
  'fa',
  'fal',
  'fals',
  'false',
  'n',
  'no',
  'of',
  'off',
  '0',
]);

/**
 * Whether PostgreSQL reads an encoding name as UTF-8. It only compares the
 * letters and digits of the name, in lower case, so `UTF8`, `utf-8` and
 * `UTF_8` all name UTF-8, and so does `UNICODE`.
 *
 * @param encoding The name, in lower case.
 */
function isUtf8(encoding: string): boolean {
  const name = encoding.replaceAll(/[^\da-z]/g, '');

  return name === 'utf8' || name === 'unicode';
}

/**
 * R6: a baseline runs as one query, which PostgreSQL reads before it runs any
 * of it. So a setting that changes how PostgreSQL reads the statements after
 * it cannot take effect, and the dump must not need it:
 * `standard_conforming_strings` off makes the backslashes in strings escapes,
 * and a `client_encoding` other than UTF-8 means that the dump is in another
 * encoding, while node-pg-migrate reads it as UTF-8.
 */
function refuseLexicalSetting(statement: Statement, name: string): void {
  const value = settingValue(statement)?.toLowerCase();
  if (value === undefined) {
    return;
  }

  if (name === 'standard_conforming_strings' && FALSE_VALUES.has(value)) {
    throw new BaselineError(
      'NON_STANDARD_STRINGS',
      `line ${statement.line}: the dump was made with standard_conforming_strings off (\`${excerpt(statement.text)}\`), so the backslashes in its strings are escapes. A migration runs as one query, which PostgreSQL reads before this SET can take effect, so those strings would get other values. Make the dump again with PGOPTIONS='-c standard_conforming_strings=on' set for pg_dump.`
    );
  }

  if (name === 'client_encoding' && !isUtf8(value)) {
    throw new BaselineError(
      'NOT_UTF8',
      `line ${statement.line}: the dump is not in UTF-8 (\`${excerpt(statement.text)}\`), but node-pg-migrate reads it as UTF-8, so its non-ASCII characters would change. Make the dump again in UTF-8, with pg_dump --encoding=UTF8.`
    );
  }
}

/**
 * R6: pg_dump's session settings would outlive the baseline. Timeouts are
 * dropped; other settings are saved, set with `SET LOCAL` and restored at the
 * end (see {@link finish}), once their value is checked (see
 * {@link refuseLexicalSetting}).
 */
function rewriteSetting(statement: Statement, context: Context): boolean {
  const setting = sessionSetting(statement);
  if (setting === undefined) {
    return false;
  }

  const { name, afterSet } = setting;
  if (name.endsWith('_timeout')) {
    return drop(statement, context);
  }

  refuseLexicalSetting(statement, name);
  if (!context.settings.has(name)) {
    context.settings.add(name);
    context.output.write(`${saveOf(name)}\n`);
  }

  context.output.write('SET LOCAL');
  context.output.keep(statement.start + afterSet, statement.end);

  return true;
}

/**
 * R7: only the owner of an extension can comment on it, and blank databases
 * get the comment with the extension.
 */
function dropExtensionComment(statement: Statement, context: Context): boolean {
  return (
    statement.hasWords(0, ['comment', 'on', 'extension']) &&
    drop(statement, context)
  );
}

/**
 * R8: every database already has the `public` schema.
 */
function dropPublicSchema(statement: Statement, context: Context): boolean {
  const index = createdSchemaIndex(statement);

  return (
    index !== -1 &&
    namesSchema(statement, index, 'public') &&
    statement.endsAt(index + 1) &&
    drop(statement, context)
  );
}

/**
 * The comment every database has on its `public` schema.
 */
const DEFAULT_PUBLIC_COMMENT = "'standard public schema'";

/**
 * R8b: the default comment on `public` is already there, and only the owner
 * of `public` could set it.
 */
function dropDefaultPublicComment(
  statement: Statement,
  context: Context
): boolean {
  return (
    statement.hasWords(0, ['comment', 'on', 'schema']) &&
    namesSchema(statement, 3, 'public') &&
    statement.word(4) === 'is' &&
    statement.token(5)?.text === DEFAULT_PUBLIC_COMMENT &&
    statement.endsAt(6) &&
    drop(statement, context)
  );
}

/**
 * R8c: node-pg-migrate may create the migrations schema and its configured
 * schemas before the baseline runs, so `CREATE SCHEMA <s>;` of one of them
 * becomes `CREATE SCHEMA IF NOT EXISTS <s>;`.
 */
function createSchemaIfNotExists(
  statement: Statement,
  context: Context
): boolean {
  const keyword = statement.token(1);
  if (
    keyword === undefined ||
    createdSchemaIndex(statement) !== 2 ||
    !statement.endsAt(3) ||
    !context.createdSchemas.some((schema) => namesSchema(statement, 2, schema))
  ) {
    return false;
  }

  const split = statement.start + keyword.end;
  context.output.keep(statement.start, split);
  context.output.write(' IF NOT EXISTS');
  context.output.keep(split, statement.end);

  return true;
}

/**
 * The rules for statements, in the order they are tried.
 */
const STATEMENT_RULES: ReadonlyArray<StatementRule> = [
  refuseData,
  refuseCreateDatabase,
  refuseDrop,
  refuseMigrationsTable,
  dropSearchPathReset,
  refuseRoleChange,
  rewriteSetting,
  dropExtensionComment,
  dropPublicSchema,
  dropDefaultPublicComment,
  createSchemaIfNotExists,
];

/**
 * What a `CREATE` statement counts as (R12), by the words after `CREATE`.
 */
const CREATED_OBJECTS: ReadonlyArray<
  readonly [ReadonlyArray<string>, keyof DumpStats]
> = [
  [['table'], 'tables'],
  [['unlogged', 'table'], 'tables'],
  [['index'], 'indexes'],
  [['unique', 'index'], 'indexes'],
  [['sequence'], 'sequences'],
  [['unlogged', 'sequence'], 'sequences'],
  [['view'], 'views'],
  [['or', 'replace', 'view'], 'views'],
  [['materialized', 'view'], 'materializedViews'],
];

/**
 * The constraints that come with an index.
 */
const INDEX_BACKED_CONSTRAINTS: ReadonlySet<string> = new Set([
  'primary',
  'unique',
  'exclude',
]);

/**
 * Whether `CONSTRAINT <name> PRIMARY KEY|UNIQUE|EXCLUDE` starts at `index`.
 */
function isIndexBackedConstraint(statement: Statement, index: number): boolean {
  const name = statement.token(index + 1);
  const kind = statement.word(index + 2);

  return (
    statement.word(index) === 'constraint' &&
    (name?.kind === 'word' || name?.kind === 'quoted') &&
    kind !== undefined &&
    INDEX_BACKED_CONSTRAINTS.has(kind)
  );
}

/**
 * Whether `GENERATED ALWAYS|BY DEFAULT AS IDENTITY` starts at `index`.
 */
function isIdentity(statement: Statement, index: number): boolean {
  const always = statement.word(index + 1) === 'always';

  return (
    statement.word(index) === 'generated' &&
    (always || statement.hasWords(index + 1, ['by', 'default'])) &&
    statement.hasWords(index + (always ? 2 : 3), ['as', 'identity'])
  );
}

/**
 * Counts the `ADD CONSTRAINT … PRIMARY KEY|UNIQUE|EXCLUDE` and
 * `ADD GENERATED … AS IDENTITY` clauses of an `ALTER TABLE` statement.
 */
function countAlterTable(statement: Statement, stats: Context['stats']): void {
  for (let index = 2; statement.token(index) !== undefined; index++) {
    if (statement.word(index) !== 'add') {
      continue;
    }

    if (isIndexBackedConstraint(statement, index + 1)) {
      stats.indexBackedConstraints += 1;
    } else if (isIdentity(statement, index + 1)) {
      stats.sequences += 1;
    }
  }
}

/**
 * R12: counts what a kept statement creates.
 */
function countObjects(statement: Statement, stats: Context['stats']): void {
  if (statement.word(0) === 'create') {
    const created = CREATED_OBJECTS.find(([words]) =>
      statement.hasWords(1, words)
    );
    if (created !== undefined) {
      stats[created[1]] += 1;
    }
  } else if (statement.hasWords(0, ['alter', 'table'])) {
    countAlterTable(statement, stats);
  }
}

/**
 * Cleans up a statement: the first rule that takes it drops, rewrites or
 * refuses it; otherwise it is kept and counted.
 */
function handleStatement(segment: TopLevelSegment, context: Context): void {
  const statement = new Statement(segment);
  if (!STATEMENT_RULES.some((rule) => rule(statement, context))) {
    countObjects(statement, context.stats);
    keepSegment(segment, context);
  }
}

/**
 * The psql meta-commands that switch to another database, which pg_dump
 * writes with `--create`.
 */
const CONNECT_COMMANDS: ReadonlySet<string> = new Set([
  String.raw`\connect`,
  String.raw`\c`,
]);

/**
 * R1: drops the `\restrict` line and then the `\unrestrict` line with the
 * same key, which pg_dump writes around a dump; refuses any other psql
 * meta-command, which is not SQL.
 */
function handleMeta(segment: TopLevelSegment, context: Context): void {
  const command = segment.text.trim();
  const [name, ...rest] = command.split(/\s+/);
  const key = rest.join(' ');
  const restrict = context.restrict;
  if (restrict === undefined && name === String.raw`\restrict` && key !== '') {
    context.restrict = { key, open: true };
  } else if (
    restrict?.open === true &&
    name === String.raw`\unrestrict` &&
    key === restrict.key
  ) {
    restrict.open = false;
  } else {
    const hint = CONNECT_COMMANDS.has(name)
      ? 'Was the dump made with --create? Make it without --create: a baseline runs in the database it is recorded in.'
      : String.raw`A baseline only drops the one \restrict … \unrestrict pair that pg_dump writes around a dump: take this line out of the dump.`;
    throw new BaselineError(
      'PSQL_META_COMMAND',
      `line ${segment.line}: \`${excerpt(command)}\` is a psql command, not SQL. ${hint}`
    );
  }
}

/**
 * The header comments of a dump that name where it comes from (R12).
 */
const SOURCE_COMMENTS: ReadonlyArray<
  readonly ['serverVersion' | 'pgDumpVersion', string]
> = [
  ['serverVersion', '-- Dumped from database version '],
  ['pgDumpVersion', '-- Dumped by pg_dump version '],
];

/**
 * The text from `from` to the end of its line.
 */
function restOfLine(text: string, from: number): string {
  const end = skipWhile(
    text,
    from,
    (code) => code !== LINE_FEED && code !== CARRIAGE_RETURN
  );

  return text.slice(from, end);
}

/**
 * The rest of the first line of a segment that starts with `prefix`, when it
 * is not empty.
 */
function commentValue(
  dump: string,
  segment: TopLevelSegment,
  prefix: string
): string | undefined {
  let at = segment.text.indexOf(prefix);
  while (at !== -1) {
    const start = segment.start + at;
    const value =
      start === 0 || codeAt(dump, start - 1) === LINE_FEED
        ? restOfLine(dump, start + prefix.length)
        : '';
    if (value !== '') {
      return value;
    }

    at = segment.text.indexOf(prefix, at + 1);
  }

  return undefined;
}

/**
 * Copies whitespace and comments to the output (but the whitespace left over
 * by a dropped statement), and reads the versions in pg_dump's header
 * comments (R12).
 */
function handleTrivia(segment: TopLevelSegment, context: Context): void {
  for (const [key, prefix] of SOURCE_COMMENTS) {
    const value =
      context.source[key] ?? commentValue(context.dump, segment, prefix);
    if (value !== undefined) {
      context.source[key] = value;
    }
  }

  context.output.keep(
    Math.max(segment.start, context.keepFrom),
    segment.start + segment.text.length
  );
}

/**
 * How each kind of segment is cleaned up. COPY data never gets here: the
 * `COPY` statement before it is refused.
 */
const SEGMENT_HANDLERS: Readonly<
  Record<SegmentKind, (segment: TopLevelSegment, context: Context) => void>
> = {
  trivia: handleTrivia,
  meta: handleMeta,
  statement: handleStatement,
  'copy-data': keepSegment,
};

/**
 * Ends a text with exactly one `\n`: blank lines at its end are dropped, and
 * a `\n` is added when its last line has none.
 */
function endWithNewline(text: string): string {
  let end = text.length;
  while (end > 0 && isSpace(codeAt(text, end - 1))) {
    end -= 1;
  }

  const newline = text.indexOf('\n', end);

  return newline === -1
    ? `${text.slice(0, end)}\n`
    : text.slice(0, newline + 1);
}

/**
 * R10: the error for a line of the output that node-pg-migrate would read as
 * a migration marker.
 */
function markerCollision(
  context: Context,
  output: string,
  marker: MarkerMatch
): BaselineError {
  const line = lineOf(context.dump, context.output.sourceOffset(marker.start));
  const text = excerpt(
    output.slice(output.lastIndexOf('\n', marker.start) + 1)
  );

  return new BaselineError(
    'MARKER_COLLISION',
    `line ${line}: \`${text}\` would be read by node-pg-migrate as the start of an up or down migration, which would cut the baseline in two. Change that line of the dump (or of the object it comes from) so that it does not start with "-- Up Migration" or "-- Down Migration".`
  );
}

/**
 * Checks the output for marker collisions (R10), ends it with one `\n`
 * (R11) and adds the restores of the saved settings (R6).
 */
function finish(context: Context): SanitizedDump {
  const output = context.output.toString();
  const marker = findMigrationMarker(output);
  if (marker !== undefined) {
    throw markerCollision(context, output, marker);
  }

  const restores = [...context.settings].map((name) => `${restoreOf(name)}\n`);
  const sql = endWithNewline(output);

  return {
    sql: restores.length > 0 ? `${sql}\n${restores.join('')}` : sql,
    stats: { ...context.stats },
    source: { ...context.source },
  };
}

/**
 * pg_dump's archive formats (R0), by the magic their files have at `offset`.
 * The header of a tar archive is ASCII, so the offset of its magic in the dump
 * is its byte offset in the file.
 */
const ARCHIVE_FORMATS: ReadonlyArray<{
  readonly format: string;
  readonly option: string;
  readonly magic: string;
  readonly offset: number;
}> = [
  { format: 'custom', option: '-Fc', magic: 'PGDMP', offset: 0 },
  { format: 'tar', option: '-Ft', magic: 'ustar', offset: 257 },
];

/**
 * The command that turns a pg_dump archive into a plain-text schema dump
 * (R0). The name of the archive file is not known here.
 */
const PG_RESTORE_COMMAND =
  'pg_restore --schema-only --no-owner --no-privileges -f schema.sql <archive>';

/**
 * R0: a baseline is made from plain SQL text, which never has a NUL
 * character. pg_dump's custom- and tar-format archives, compressed files and
 * UTF-16 text read as UTF-8 have some.
 */
function refuseBinaryDump(dump: string): void {
  if (!dump.includes('\0')) {
    return;
  }

  const archive = ARCHIVE_FORMATS.find(({ magic, offset }) =>
    dump.startsWith(magic, offset)
  );
  throw new BaselineError(
    'BINARY_DUMP',
    archive === undefined
      ? "the dump is not SQL text: it may be compressed, or saved as UTF-16. Decompress it, save it as UTF-8, or make a plain-text dump (pg_dump's default format)."
      : `the dump is a pg_dump ${archive.format}-format archive (pg_dump ${archive.option}), not SQL text. Turn it into SQL with ${PG_RESTORE_COMMAND}, then make the baseline from schema.sql.`
  );
}

/**
 * The state of the cleanup of a dump with these options.
 */
function createContext(dump: string, options: SanitizeOptions): Context {
  const { migrationsSchema, migrationsTable, migrationsSequence } = options;

  return {
    dump,
    output: new SqlWriter(dump),
    migrationsTable: { schema: migrationsSchema, name: migrationsTable },
    migrationsSequence: {
      schema: migrationsSequence?.schema ?? migrationsSchema,
      name: migrationsSequence?.name ?? `${migrationsTable}_id_seq`,
    },
    createdSchemas: [migrationsSchema, ...(options.createdSchemas ?? [])],
    settings: new Set(),
    stats: {
      tables: 0,
      indexes: 0,
      indexBackedConstraints: 0,
      sequences: 0,
      views: 0,
      materializedViews: 0,
    },
    source: {},
    restrict: undefined,
    keepFrom: 0,
  };
}

/**
 * Turns a `pg_dump --schema-only` output into the body of a baseline
 * migration, which runs inside node-pg-migrate's migration transaction.
 *
 * The `\restrict` / `\unrestrict` pair, the `search_path` reset,
 * `*_timeout` settings, `COMMENT ON EXTENSION`, `CREATE SCHEMA public` and
 * the default comment on `public` are dropped. Other session settings become
 * `SET LOCAL` and are restored at the end, so they do not leak into the
 * migrations that run after the baseline in the same transaction.
 * `CREATE SCHEMA` of the migrations schema or of `createdSchemas` becomes
 * `CREATE SCHEMA IF NOT EXISTS`. Everything else is kept byte for byte, and
 * the output ends with one `\n`.
 *
 * Throws a `BaselineError` when the dump cannot be a baseline: it is not SQL
 * text (a pg_dump custom- or tar-format archive, a compressed file or UTF-16
 * text), has a psql meta-command, data (`COPY … FROM stdin`, `INSERT` or
 * `setval()`), `CREATE DATABASE` or `DROP` statements, changes the role
 * (`SET ROLE`, `SET SESSION AUTHORIZATION`), was made with
 * `standard_conforming_strings` off or a `client_encoding` other than UTF-8,
 * creates the migrations table or its sequence, or has a line that
 * node-pg-migrate would read as an up/down migration marker.
 *
 * @param dump The pg_dump output.
 * @param options The migrations table and sequence, which the dump must not
 * create, and the schemas node-pg-migrate may create before the baseline
 * runs.
 */
export function sanitizeDump(
  dump: string,
  options: SanitizeOptions
): SanitizedDump {
  refuseBinaryDump(dump);
  const context = createContext(dump, options);
  for (const segment of scanTopLevel(dump)) {
    SEGMENT_HANDLERS[segment.kind](segment, context);
  }

  return finish(context);
}
