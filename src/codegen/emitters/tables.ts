import { parseQualifiedName } from '../../baseline/core/identifiers';
import type {
  Column,
  SchemaQualifiedName,
  Table,
} from '../../introspect/types';
import type { Code } from '../code';
import { array, func, isEmpty, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import {
  makeObjectName,
  qualifiedName,
  quoteLiteral,
  quoteName,
  storageParameters,
} from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';
import {
  hasUnsafeNumber,
  hasZero,
  sequenceOptionsCode,
  sequenceOptionsSql,
  writtenSequenceOptions,
} from './sequenceOptions';
import { hasLineBreak, keepsKeyOrder } from './shared';

/**
 * The `serial` type of each integer type.
 */
const SERIAL_TYPES: Readonly<Record<string, string>> = {
  smallint: 'smallserial',
  integer: 'serial',
  bigint: 'bigserial',
};

/**
 * `nextval('<sequence>'::regclass)`, the default of a column that takes its
 * values from a sequence, as `pg_get_expr()` writes it.
 */
const NEXTVAL = /^nextval\('(?<sequence>(?:[^']|'')+)'::regclass\)$/;

/**
 * One column of a partition key that `pg_get_partkeydef()` writes as a
 * plain (possibly quoted) column name.
 */
const KEY_COLUMN = /"(?:[^"]|"")+"|[_a-z][\d_a-z]*/y;

/**
 * A partition key as `CreateTableOptions.partition` takes it.
 */
interface PartitionKey {
  readonly strategy: string;
  readonly columns: ReadonlyArray<string>;
}

/**
 * Reads a partition key (`pg_get_partkeydef()`, e.g. `RANGE (region,
 * "Measured At")`) whose keys are all plain columns; `undefined` when a key
 * is an expression or has a collation or an operator class, which the
 * `partition` option of `createTable` does not take here.
 */
function parsePartitionKey(key: string): PartitionKey | undefined {
  const open = key.indexOf(' (');
  const strategy = key.slice(0, open);
  if (!['RANGE', 'LIST', 'HASH'].includes(strategy) || !key.endsWith(')')) {
    return undefined;
  }

  const list = key.slice(open + 2, -1);
  const columns: string[] = [];
  KEY_COLUMN.lastIndex = 0;
  for (;;) {
    const match = KEY_COLUMN.exec(list);
    if (match === null) {
      return undefined;
    }

    const [text] = match;
    columns.push(
      text.startsWith('"') ? text.slice(1, -1).replaceAll('""', '"') : text
    );
    if (KEY_COLUMN.lastIndex === list.length) {
      return { strategy, columns };
    }

    if (!list.startsWith(', ', KEY_COLUMN.lastIndex)) {
      return undefined;
    }

    KEY_COLUMN.lastIndex += 2;
  }
}

/**
 * The sequence a `nextval('…'::regclass)` default takes its values from.
 */
function nextvalSequence(expression: string):
  | {
      readonly schema?: string;
      readonly name: string;
    }
  | undefined {
  const text = NEXTVAL.exec(expression)?.groups?.sequence.replaceAll("''", "'");
  const name = text === undefined ? undefined : parseQualifiedName(text, 0);

  return name?.end === text?.length ? name : undefined;
}

/**
 * Whether a column is written as `serial`, `bigserial` or `smallserial`
 * (see {@link emitTable}): what `serial` would have made.
 */
function isSerial(table: Table, column: Column): boolean {
  const sequence = column.ownedSequence;
  if (
    sequence === undefined ||
    column.default === undefined ||
    !column.notNull ||
    !column.local ||
    SERIAL_TYPES[column.type] === undefined ||
    sequence.unlogged !== table.unlogged ||
    sequence.name.schema !== table.schema ||
    sequence.name.name !== makeObjectName(table.name, column.name, 'seq')
  ) {
    return false;
  }

  const written = writtenSequenceOptions(sequence.options, column.type);
  const used = nextvalSequence(column.default);

  return (
    used?.schema === sequence.name.schema &&
    used.name === sequence.name.name &&
    sequenceOptionsSql(written).length === 0
  );
}

/**
 * The columns that `CREATE TABLE` lists: an inheritance child only lists the
 * columns it defines itself.
 */
function localColumns(table: Table): Column[] {
  return table.columns.filter((column) => column.local);
}

/**
 * Whether the `NOT NULL` constraint of a local column has another name than
 * the one PostgreSQL gives it (`<table>_<column>_not_null`).
 */
function hasCustomNotNullName(table: Table, column: Column): boolean {
  const constraint = column.notNullConstraint;

  return (
    constraint !== undefined &&
    constraint.name !== makeObjectName(table.name, column.name, 'not_null')
  );
}

/**
 * Whether the identity sequence of a column has another name than the one
 * PostgreSQL gives it (`<table>_<column>_seq` in the table's schema).
 */
function hasCustomIdentityName(table: Table, column: Column): boolean {
  const identity = column.identity;

  return (
    identity !== undefined &&
    (identity.sequence.schema !== table.schema ||
      identity.sequence.name !== makeObjectName(table.name, column.name, 'seq'))
  );
}

function hasColumnSettings(column: Column): boolean {
  return (
    column.statisticsTarget !== undefined ||
    column.storage !== undefined ||
    column.compression !== undefined ||
    column.options.length > 0
  );
}

/**
 * The text of a column that `createTable` writes on one line.
 */
function columnText(column: Column): string {
  return [
    column.name,
    column.type,
    column.collation ?? '',
    column.default ?? '',
    column.generated?.expression ?? '',
  ].join(' ');
}

/**
 * The reasons that only concern the `createTable` call, which a partition
 * never uses.
 */
function createTableReasons(
  table: Table,
  local: ReadonlyArray<Column>
): string[] {
  const reasons: string[] = [];
  if (
    table.partitionKey !== undefined &&
    parsePartitionKey(table.partitionKey) === undefined
  ) {
    reasons.push('partition key');
  }

  if (local.some((column) => column.notNullConstraint?.noInherit === true)) {
    reasons.push('NOT NULL NO INHERIT');
  }

  if (local.some((column) => column.notNullConstraint?.validated === false)) {
    reasons.push('NOT NULL NOT VALID');
  }

  const identities = local.flatMap((column) =>
    column.identity === undefined
      ? []
      : [writtenSequenceOptions(column.identity.options, column.type)]
  );
  if (identities.some(hasUnsafeNumber)) {
    reasons.push('bigint option');
  }

  if (identities.some(hasZero)) {
    reasons.push('zero option');
  }

  if (!keepsKeyOrder(local.map((column) => column.name))) {
    reasons.push('column order');
  }

  if (local.length === 0) {
    reasons.push('no columns');
  }

  if (local.some((column) => hasLineBreak(columnText(column)))) {
    reasons.push('line break');
  }

  return reasons;
}

/**
 * Why the whole table is created with raw SQL, in the order of the JSDoc of
 * {@link emitTable}.
 */
function fallbackReasons(table: Table): string[] {
  const local = localColumns(table);
  const reasons: string[] = [];
  if (table.partitionOf !== undefined) {
    reasons.push('partition');
  }

  if (table.columns.some((column) => column.generated?.storage === 'VIRTUAL')) {
    reasons.push('virtual generated column');
  }

  if (table.options.length > 0) {
    reasons.push('storage parameters');
  }

  if (table.accessMethod !== undefined) {
    reasons.push('access method');
  }

  if (table.inherits.length > 1) {
    reasons.push('multiple inheritance');
  }

  if (local.some((column) => hasCustomIdentityName(table, column))) {
    reasons.push('identity sequence name');
  }

  if (local.some((column) => hasCustomNotNullName(table, column))) {
    reasons.push('NOT NULL constraint name');
  }

  if (table.columns.some(hasColumnSettings)) {
    reasons.push('column settings');
  }

  if (table.replicaIdentity === 'FULL' || table.replicaIdentity === 'NOTHING') {
    reasons.push('replica identity');
  }

  if (table.partitionOf === undefined) {
    reasons.push(...createTableReasons(table, local));
  }

  return reasons;
}

/**
 * The sequences that {@link emitTable} creates with a `serial`, `bigserial`
 * or `smallserial` column, so that they are not created on their own: none
 * when the whole table is created with raw SQL.
 *
 * @param table The table.
 */
export function serialSequences(
  table: Table
): ReadonlyArray<SchemaQualifiedName> {
  if (fallbackReasons(table).length > 0) {
    return [];
  }

  return table.columns.flatMap((column) =>
    column.ownedSequence !== undefined && isSerial(table, column)
      ? [column.ownedSequence.name]
      : []
  );
}

/**
 * The SQL of a column of `CREATE TABLE` (whole-table fallback).
 */
function columnSql(table: Table, column: Column): string {
  const parts = [quoteName(column.name), column.type];
  if (column.collation !== undefined) {
    parts.push(`COLLATE ${column.collation}`);
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  if (column.generated !== undefined) {
    parts.push(
      `GENERATED ALWAYS AS (${column.generated.expression}) ${column.generated.storage}`
    );
  }

  const { identity } = column;
  if (identity !== undefined) {
    const options = sequenceOptionsSql(
      writtenSequenceOptions(identity.options, column.type)
    );
    if (hasCustomIdentityName(table, column)) {
      options.unshift(`SEQUENCE NAME ${qualifiedName(identity.sequence)}`);
    }

    parts.push(
      `GENERATED ${identity.generation} AS IDENTITY${options.length === 0 ? '' : ` (${options.join(' ')})`}`
    );
  }

  const constraint = column.notNullConstraint;
  if (column.notNull && constraint?.validated !== false) {
    if (constraint !== undefined && hasCustomNotNullName(table, column)) {
      parts.push(`CONSTRAINT ${quoteName(constraint.name)}`);
    }

    parts.push(
      constraint?.noInherit === true ? 'NOT NULL NO INHERIT' : 'NOT NULL'
    );
  }

  return parts.join(' ');
}

/**
 * The options of a column of a partition (`WITH OPTIONS …`): its default
 * and its `NOT NULL` constraint, with its name when it has one, so that a
 * partition gets them even when its partitioned table does not have them.
 */
function partitionColumnSql(column: Column): string[] {
  const parts: string[] = [];
  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  if (column.notNull) {
    const constraint = column.notNullConstraint;
    parts.push(
      constraint === undefined
        ? 'NOT NULL'
        : `CONSTRAINT ${quoteName(constraint.name)} NOT NULL`
    );
  }

  return parts.length === 0
    ? []
    : [`${quoteName(column.name)} WITH OPTIONS ${parts.join(' ')}`];
}

/**
 * The statements that set the settings of the columns (whole-table
 * fallback).
 */
function columnSettingsSql(name: string, column: Column): string[] {
  const alter = `ALTER TABLE ${name} ALTER COLUMN ${quoteName(column.name)}`;
  const statements: string[] = [];
  if (column.statisticsTarget !== undefined) {
    statements.push(
      `${alter} SET STATISTICS ${String(column.statisticsTarget)};`
    );
  }

  if (column.storage !== undefined) {
    statements.push(`${alter} SET STORAGE ${column.storage};`);
  }

  if (column.compression !== undefined) {
    statements.push(`${alter} SET COMPRESSION ${column.compression};`);
  }

  if (column.options.length > 0) {
    statements.push(`${alter} SET (${column.options.join(', ')});`);
  }

  return statements;
}

/**
 * `COMMENT ON COLUMN` for each column in `columns` that has a comment.
 */
function columnCommentsSql(
  name: string,
  columns: ReadonlyArray<Column>
): string[] {
  return columns.flatMap((column) =>
    column.comment === undefined
      ? []
      : [
          `COMMENT ON COLUMN ${name}.${quoteName(column.name)} IS ${quoteLiteral(column.comment)};`,
        ]
  );
}

/**
 * The statements of a whole-table fallback.
 */
function createTableSql(table: Table): string[] {
  const name = qualifiedName(table);
  const unlogged = table.unlogged ? ' UNLOGGED' : '';
  let create: string;
  if (table.partitionOf === undefined) {
    const columns = localColumns(table).map((column) =>
      columnSql(table, column)
    );
    const inherits =
      table.inherits.length === 0
        ? ''
        : ` INHERITS (${table.inherits.map(qualifiedName).join(', ')})`;
    create = `CREATE${unlogged} TABLE ${name} (${columns.join(', ')})${inherits}`;
  } else {
    const options = table.columns.flatMap(partitionColumnSql);
    const list = options.length === 0 ? '' : ` (${options.join(', ')})`;
    create = `CREATE${unlogged} TABLE ${name} PARTITION OF ${qualifiedName(table.partitionOf.parent)}${list} ${table.partitionOf.bound}`;
  }

  const partitionBy =
    table.partitionKey === undefined
      ? ''
      : ` PARTITION BY ${table.partitionKey}`;
  const using =
    table.accessMethod === undefined
      ? ''
      : ` USING ${quoteName(table.accessMethod)}`;
  const withOptions =
    table.options.length === 0
      ? ''
      : ` WITH (${storageParameters(table.options)})`;
  const statements = [`${create}${partitionBy}${using}${withOptions};`];
  for (const column of localColumns(table)) {
    const constraint = column.notNullConstraint;
    if (constraint?.validated === false) {
      statements.push(
        `ALTER TABLE ${name} ADD CONSTRAINT ${quoteName(constraint.name)} NOT NULL ${quoteName(column.name)}${constraint.noInherit ? ' NO INHERIT' : ''} NOT VALID;`
      );
    }
  }

  statements.push(
    ...table.columns.flatMap((column) => columnSettingsSql(name, column))
  );
  if (table.replicaIdentity === 'FULL' || table.replicaIdentity === 'NOTHING') {
    statements.push(
      `ALTER TABLE ${name} REPLICA IDENTITY ${table.replicaIdentity};`
    );
  }

  if (table.comment !== undefined) {
    statements.push(
      `COMMENT ON TABLE ${name} IS ${quoteLiteral(table.comment)};`
    );
  }

  statements.push(...columnCommentsSql(name, table.columns));

  return statements;
}

/**
 * A column as `createTable` takes it: the type alone when there is nothing
 * else to say.
 */
function columnCode(table: Table, column: Column): Code {
  if (isSerial(table, column)) {
    const type = str(SERIAL_TYPES[column.type]);

    return column.comment === undefined
      ? type
      : object([
          ['type', type],
          ['comment', str(column.comment)],
        ]);
  }

  const { identity, generated } = column;
  const definition = object([
    ['type', str(column.type)],
    [
      'collation',
      column.collation === undefined ? undefined : str(column.collation),
    ],
    [
      'default',
      column.default === undefined ? undefined : func(column.default),
    ],
    [
      'notNull',
      column.notNull && identity === undefined ? raw('true') : undefined,
    ],
    [
      'sequenceGenerated',
      identity === undefined
        ? undefined
        : object([
            ['precedence', str(identity.generation)],
            ...sequenceOptionsCode(
              writtenSequenceOptions(identity.options, column.type)
            ),
          ]),
    ],
    [
      'expressionGenerated',
      generated === undefined ? undefined : str(generated.expression),
    ],
    ['comment', column.comment === undefined ? undefined : str(column.comment)],
  ]);

  return definition.kind === 'object' && definition.entries.length === 1
    ? str(column.type)
    : definition;
}

/**
 * `pgm.createTable(name, columns, { comment, partition, inherits, unlogged
 * })`, with the table's and its columns' comments. Columns have `type`,
 * `notNull`, `default: pgm.func(…)`, `sequenceGenerated`,
 * `expressionGenerated`, `collation` and `comment`; an inheritance child
 * only lists its local columns. A column is `serial` / `bigserial` /
 * `smallserial` (and its `ownedSequence` is not emitted on its own) when it
 * is `NOT NULL`, its type is `integer` / `bigint` / `smallint`, its default
 * is `nextval('<ownedSequence>'::regclass)`, and the owned sequence is named
 * `<table>_<column>_seq` in the table's schema, has the column's type and
 * default options, and is logged like the table.
 *
 * Comments on columns that an inheritance child only inherits (which
 * `createTable` cannot list) are set after it with `pgm.sql('COMMENT ON
 * COLUMN …')`, which makes the step a fallback, reason `'comment on
 * column'`.
 *
 * The WHOLE table becomes one fallback, `CREATE TABLE …` built from the
 * model (columns in order, comments included), when it is a partition
 * (`CREATE TABLE … PARTITION OF … FOR VALUES …`), reason `'partition'`; has a
 * virtual generated column, `'virtual generated column'`; storage parameters,
 * `'storage parameters'`; a non-heap access method, `'access method'`;
 * several parents, `'multiple inheritance'`; an identity sequence that is not
 * named `<table>_<column>_seq`, `'identity sequence name'`; a `NOT NULL`
 * constraint whose name is not the default, `'NOT NULL constraint name'`;
 * column statistics, storage, compression or options, `'column settings'`;
 * or a `REPLICA IDENTITY` of `FULL` or `NOTHING`, `'replica identity'`. And,
 * for a table that is not a partition, because of what `createTable` itself
 * cannot write: a partition key with an expression, a collation or an
 * operator class, `'partition key'`; a `NOT NULL` constraint that is `NO
 * INHERIT` or `NOT VALID` (PostgreSQL 18), `'NOT NULL NO INHERIT'` / `'NOT
 * NULL NOT VALID'`; identity options beyond `Number.MAX_SAFE_INTEGER` or
 * equal to `0` (`sequenceGenerated` leaves out falsy values), `'bigint
 * option'` / `'zero option'`; column names that an object would reorder
 * (integer-like names such as `'1'` come first), `'column order'`; no column
 * to list, `'no columns'`; or a column whose name, type, collation, default
 * or expression has a line break (`createTable` writes each column on one
 * line), `'line break'`. With several reasons, they are joined with `', '`.
 *
 * In a whole-table fallback, a column that would be `serial` keeps its
 * `DEFAULT nextval(…)` (its sequence is created and owned on its own), the
 * columns of a partition get their defaults and `NOT NULL` constraints (with
 * their names) with `WITH OPTIONS`, and column settings and comments follow
 * as `ALTER TABLE` and `COMMENT ON` statements.
 *
 * @param table The table.
 * @param ctx The migration context.
 */
export function emitTable(table: Table, ctx: EmitContext): Emitted {
  const reasons = fallbackReasons(table);
  if (reasons.length > 0) {
    return withStatements('', createTableSql(table), reasons);
  }

  const partition =
    table.partitionKey === undefined
      ? undefined
      : parsePartitionKey(table.partitionKey);
  const [parent] = table.inherits;
  const options = object([
    ['comment', table.comment === undefined ? undefined : str(table.comment)],
    [
      'partition',
      partition === undefined
        ? undefined
        : object([
            ['strategy', str(partition.strategy)],
            ['columns', array(partition.columns.map(str))],
          ]),
    ],
    ['inherits', parent === undefined ? undefined : nameCode(parent, ctx)],
    ['unlogged', table.unlogged ? raw('true') : undefined],
  ]);
  const code = statement('createTable', [
    nameCode(table, ctx),
    object(
      localColumns(table).map((column) => [
        column.name,
        columnCode(table, column),
      ])
    ),
    ...(isEmpty(options) ? [] : [options]),
  ]);
  const inherited = table.columns.filter((column) => !column.local);
  const comments = columnCommentsSql(qualifiedName(table), inherited);

  return withStatements(
    code,
    comments,
    comments.length === 0 ? [] : ['comment on column']
  );
}
