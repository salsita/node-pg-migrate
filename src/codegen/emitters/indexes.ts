import { parseQualifiedName } from '../../baseline/core/identifiers';
import type { Index, IndexKey } from '../../introspect/types';
import type { Code } from '../code';
import { array, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';

/**
 * The index methods that `CreateIndexOptions.method` takes.
 */
const METHODS: ReadonlySet<string> = new Set([
  'btree',
  'hash',
  'gist',
  'spgist',
  'gin',
]);

/**
 * A column name that `createIndex` quotes as it is: its heuristics treat any
 * other character as the sign of an expression.
 */
const PLAIN_COLUMN = /^[\w".]+$/;

/**
 * The key as `createIndex` takes it. A column is its name, or its quoted
 * name when `createIndex` would take the name for an expression (then it
 * writes `("Order Date")`, which PostgreSQL reads as the column). An
 * expression is written as it is, or in parentheses when it looks like a
 * name (`createIndex` would quote it).
 */
function keyCode(key: IndexKey): Code {
  let name: string;
  if ('column' in key) {
    name = PLAIN_COLUMN.test(key.column) ? key.column : quoteName(key.column);
  } else {
    name = PLAIN_COLUMN.test(key.expression)
      ? `(${key.expression})`
      : key.expression;
  }

  return key.descending
    ? object([
        ['name', str(name)],
        ['sort', str('DESC')],
      ])
    : str(name);
}

/**
 * The definition of an index for the fallback: `pg_get_indexdef()` writes
 * `ON ONLY` for a partitioned table, which would not create the indexes of
 * its partitions (the model has no index of a partition that an index of
 * its partitioned table made), so `ONLY` is left out.
 */
function definitionSql(definition: string): string {
  const prefix = ['CREATE UNIQUE INDEX ', 'CREATE INDEX '].find((start) =>
    definition.startsWith(start)
  );
  const name =
    prefix === undefined
      ? undefined
      : parseQualifiedName(definition, prefix.length);
  const only = ' ON ONLY ';
  if (name !== undefined && definition.startsWith(only, name.end)) {
    return terminated(
      `${definition.slice(0, name.end)} ON ${definition.slice(name.end + only.length)}`
    );
  }

  return terminated(definition);
}

/**
 * Why `createIndex` cannot create an index, in the order of the JSDoc of
 * {@link emitIndex}.
 */
function definitionReasons(index: Index): string[] {
  const reasons: string[] = [];
  if (!METHODS.has(index.method)) {
    reasons.push(`index method ${index.method}`);
  }

  if (index.keys.some((key) => key.opclass !== undefined)) {
    reasons.push('operator class');
  }

  if (index.keys.some((key) => key.collation !== undefined)) {
    reasons.push('collation');
  }

  if (index.keys.some((key) => key.nullsFirst !== key.descending)) {
    reasons.push('nulls order');
  }

  if (index.options.length > 0) {
    reasons.push('storage parameters');
  }

  return reasons;
}

/**
 * `pgm.createIndex(table, columns, { name, unique, where, include, method,
 * nulls })` for an index whose keys are columns or expressions without an
 * operator class or collation, each `ASC` or `DESC` with its default nulls
 * order, and whose method is one `CreateIndexOptions.method` allows
 * (`btree`, `hash`, `gist`, `spgist`, `gin`).
 *
 * Anything else is a fallback (`pg_get_indexdef`, `definition`, without the
 * `ONLY` of `ON ONLY`, so that an index of a partitioned table is created on
 * its partitions too), reason `'index method <method>'`, `'operator class'`,
 * `'collation'`, `'nulls order'` or `'storage parameters'`; so is an index
 * the table is clustered on or uses as its replica identity (the index is
 * created, then `ALTER TABLE … CLUSTER ON …` / `REPLICA IDENTITY USING INDEX
 * …`), reason `'CLUSTER ON'` / `'replica identity'`. With several reasons,
 * they are joined with `', '`.
 *
 * @param index The index.
 * @param ctx The migration context.
 */
export function emitIndex(index: Index, ctx: EmitContext): Emitted {
  const table = qualifiedName(index.table);
  const after: string[] = [];
  const afterReasons: string[] = [];
  if (index.clustered) {
    afterReasons.push('CLUSTER ON');
    after.push(`ALTER TABLE ${table} CLUSTER ON ${quoteName(index.name)};`);
  }

  if (index.replicaIdentity) {
    afterReasons.push('replica identity');
    after.push(
      `ALTER TABLE ${table} REPLICA IDENTITY USING INDEX ${quoteName(index.name)};`
    );
  }

  const reasons = definitionReasons(index);
  if (reasons.length > 0) {
    return withStatements(
      '',
      [definitionSql(index.definition), ...after],
      [...reasons, ...afterReasons]
    );
  }

  const code = statement('createIndex', [
    nameCode(index.table, ctx),
    array(index.keys.map(keyCode)),
    object([
      ['name', str(index.name)],
      ['unique', index.unique ? raw('true') : undefined],
      [
        'where',
        index.predicate === undefined ? undefined : str(index.predicate),
      ],
      [
        'include',
        index.include.length === 0 ? undefined : array(index.include.map(str)),
      ],
      ['method', index.method === 'btree' ? undefined : str(index.method)],
      [
        'nulls',
        index.unique && index.nullsNotDistinct
          ? str('not distinct')
          : undefined,
      ],
    ]),
  ]);

  return withStatements(code, after, afterReasons);
}
