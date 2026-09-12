// SQL text for the fallbacks (`pgm.sql(…)`) and for the few options of the
// `pgm` operations that are written into their SQL as they are.

import type { QualifiedName } from '../baseline/types';
import { quote } from '../utils/quote';

/**
 * The longest name PostgreSQL stores, in bytes (`NAMEDATALEN - 1`).
 */
const MAX_NAME_BYTES = 63;

/**
 * The keywords that PostgreSQL's `quote_identifier()` quotes: every keyword
 * that is not unreserved (the reserved, column-name and type-or-function-name
 * keywords of `kwlist.h`).
 */
const QUOTED_KEYWORDS: ReadonlySet<string> = new Set([
  // reserved
  'all',
  'analyse',
  'analyze',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'asymmetric',
  'both',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'constraint',
  'create',
  'current_catalog',
  'current_date',
  'current_role',
  'current_time',
  'current_timestamp',
  'current_user',
  'default',
  'deferrable',
  'desc',
  'distinct',
  'do',
  'else',
  'end',
  'except',
  'false',
  'fetch',
  'for',
  'foreign',
  'from',
  'grant',
  'group',
  'having',
  'in',
  'initially',
  'intersect',
  'into',
  'lateral',
  'leading',
  'limit',
  'localtime',
  'localtimestamp',
  'not',
  'null',
  'offset',
  'on',
  'only',
  'or',
  'order',
  'placing',
  'primary',
  'references',
  'returning',
  'select',
  'session_user',
  'some',
  'symmetric',
  'system_user',
  'table',
  'then',
  'to',
  'trailing',
  'true',
  'union',
  'unique',
  'user',
  'using',
  'variadic',
  'when',
  'where',
  'window',
  'with',
  // type or function names
  'authorization',
  'binary',
  'collation',
  'concurrently',
  'cross',
  'current_schema',
  'freeze',
  'full',
  'ilike',
  'inner',
  'is',
  'isnull',
  'join',
  'left',
  'like',
  'natural',
  'notnull',
  'outer',
  'overlaps',
  'right',
  'similar',
  'tablesample',
  'verbose',
  // column names
  'between',
  'bigint',
  'bit',
  'boolean',
  'char',
  'character',
  'coalesce',
  'dec',
  'decimal',
  'exists',
  'extract',
  'float',
  'greatest',
  'grouping',
  'inout',
  'int',
  'integer',
  'interval',
  'json',
  'json_array',
  'json_arrayagg',
  'json_exists',
  'json_object',
  'json_objectagg',
  'json_query',
  'json_scalar',
  'json_serialize',
  'json_table',
  'json_value',
  'least',
  'merge_action',
  'national',
  'nchar',
  'none',
  'normalize',
  'nullif',
  'numeric',
  'out',
  'overlay',
  'position',
  'precision',
  'real',
  'row',
  'setof',
  'smallint',
  'substring',
  'time',
  'timestamp',
  'treat',
  'trim',
  'values',
  'varchar',
  'xmlattributes',
  'xmlconcat',
  'xmlelement',
  'xmlexists',
  'xmlforest',
  'xmlnamespaces',
  'xmlparse',
  'xmlpi',
  'xmlroot',
  'xmlserialize',
  'xmltable',
]);

const SAFE_IDENTIFIER = /^[_a-z][\d_a-z]*$/;

/**
 * An identifier in double quotes, with `"` doubled: always safe to use.
 *
 * @param name The name, as PostgreSQL stores it.
 */
export function quoteName(name: string): string {
  return quote(name);
}

/**
 * An identifier quoted only when it has to be, like PostgreSQL's
 * `quote_identifier()`: a name of lower-case letters, digits and underscores
 * that is not a keyword stays as it is, e.g. `app_user`.
 *
 * @param name The name, as PostgreSQL stores it.
 */
export function quoteIdentifier(name: string): string {
  return SAFE_IDENTIFIER.test(name) && !QUOTED_KEYWORDS.has(name)
    ? name
    : quote(name);
}

/**
 * A name with its schema, both quoted (`"schema"."name"`), or the quoted
 * name alone without a schema.
 *
 * @param name The name.
 */
export function qualifiedName(name: QualifiedName): string {
  return name.schema === undefined
    ? quote(name.name)
    : `${quote(name.schema)}.${quote(name.name)}`;
}

/**
 * A string constant, like PostgreSQL's `quote_literal()`: `'…'` with `'`
 * doubled, or `E'…'` with backslashes doubled too when the value has a
 * backslash, so that it means the same whatever `standard_conforming_strings`
 * is.
 *
 * @param value The string.
 */
export function quoteLiteral(value: string): string {
  const quoted = value.replaceAll("'", "''");

  return value.includes('\\')
    ? `E'${quoted.replaceAll('\\', '\\\\')}'`
    : `'${quoted}'`;
}

/**
 * Makes sure a statement ends with `;`, without trailing whitespace.
 *
 * @param sql The statement.
 */
export function terminated(sql: string): string {
  const trimmed = sql.trimEnd();

  return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
}

/**
 * The longest start of `text` that is at most `maxBytes` bytes in UTF-8,
 * without cutting a character (`pg_mbcliplen()`).
 */
function clipToBytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text) <= maxBytes) {
    return text;
  }

  let bytes = 0;
  let end = 0;
  for (const char of text) {
    bytes += Buffer.byteLength(char);
    if (bytes > maxBytes) {
      break;
    }

    end += char.length;
  }

  return text.slice(0, end);
}

/**
 * The name PostgreSQL gives an object it names after other names, like
 * `makeObjectName()`: `<name1>_<name2>_<label>` (or `<name1>_<label>`), the
 * longer of the two names shortened first when the result would be longer
 * than 63 bytes. E.g. the sequence of the `serial` or identity column `id` of
 * `users` is `users_id_seq`, and its PostgreSQL 18 `NOT NULL` constraint is
 * `users_id_not_null`, unless those names were taken.
 *
 * @param name1 The first name, e.g. the table.
 * @param name2 The second name, e.g. the column, if any.
 * @param label What the object is, e.g. `seq`.
 */
export function makeObjectName(
  name1: string,
  name2: string | undefined,
  label: string
): string {
  const overhead = label.length + 1 + (name2 === undefined ? 0 : 1);
  const available = MAX_NAME_BYTES - overhead;
  let bytes1 = Buffer.byteLength(name1);
  let bytes2 = name2 === undefined ? 0 : Buffer.byteLength(name2);
  while (bytes1 + bytes2 > available) {
    if (bytes1 > bytes2) {
      bytes1 -= 1;
    } else {
      bytes2 -= 1;
    }
  }

  const first = clipToBytes(name1, bytes1);

  return name2 === undefined
    ? `${first}_${label}`
    : `${first}_${clipToBytes(name2, bytes2)}_${label}`;
}

/**
 * The name `CREATE TYPE … AS RANGE` gives the multirange type of a range
 * type (`makeMultirangeTypeName()`): the first `range` in the name becomes
 * `multirange`, or `_multirange` is appended when there is none.
 *
 * @param rangeName The name of the range type.
 */
export function defaultMultirangeName(rangeName: string): string {
  const at = rangeName.indexOf('range');
  const name =
    at === -1
      ? `${clipToBytes(rangeName, MAX_NAME_BYTES - 11)}_multirange`
      : `${rangeName.slice(0, at)}multi${rangeName.slice(at)}`;

  return clipToBytes(name, MAX_NAME_BYTES);
}

/**
 * Storage parameters as `WITH (…)` takes them, the way pg_dump writes them:
 * `name=value` separated by `, `, the value in quotes unless it is a plain
 * identifier, e.g. `fillfactor='70', autovacuum_enabled='false'`. A name
 * with a namespace (`toast.autovacuum_enabled`, a parameter of the TOAST
 * table) is written as the namespace and the name, each quoted only when it
 * has to be, since `WITH (…)` would read a quoted `"toast.…"` as one name.
 *
 * @param options The parameters, each as stored (`name=value`, or
 * `toast.name=value`).
 */
export function storageParameters(options: ReadonlyArray<string>): string {
  return options
    .map((option) => {
      const equals = option.indexOf('=');
      const name = equals === -1 ? option : option.slice(0, equals);
      const value = equals === -1 ? '' : option.slice(equals + 1);
      const valueSql =
        quoteIdentifier(value) === value ? value : quoteLiteral(value);

      return `${name.split('.').map(quoteIdentifier).join('.')}=${valueSql}`;
    })
    .join(', ');
}
