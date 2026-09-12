import type { Index, IndexKey } from '../../introspect/types';
import type { Code } from '../code';
import { array, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { sqlStatement, withStatements } from './fallback';
import {
  namedPartitionIndexes,
  partitionIndexSettings,
  withoutOnly,
} from './shared';

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
  return terminated(withoutOnly(definition) ?? definition);
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
 * The statements that create an index of a partitioned table that is not
 * valid, like pg_dump: each index of a partition attached to it, from its own
 * definition, then the index `ON ONLY` the table, then `ALTER INDEX …
 * ATTACH PARTITION …` for each of them (deepest first, each to the index it
 * is attached to). The partitions that have no index attached get none:
 * creating the index without `ONLY` would give them one, and make it valid.
 */
function invalidIndexSql(index: Index): string[] {
  const partitionIndexes = index.partitionIndexes ?? [];

  return [
    ...partitionIndexes.map((partitionIndex) =>
      terminated(partitionIndex.definition)
    ),
    terminated(index.definition),
    ...partitionIndexes.map(
      (partitionIndex) =>
        `ALTER INDEX ${qualifiedName(partitionIndex.parent ?? index)} ATTACH PARTITION ${qualifiedName({ schema: partitionIndex.table.schema, name: partitionIndex.name })};`
    ),
  ];
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
 * The indexes of partitions attached to an index of a partitioned table
 * (`partitionIndexes`) come with it, except those whose name is not the one
 * PostgreSQL would give them: each of those is created first, from its own
 * definition (without `ONLY`), so that creating the index of the partitioned
 * table attaches it instead of creating one with another name. That is a
 * fallback too, reason `'partition index name'`, after the reasons of the
 * definition and before the others.
 *
 * An index of a partitioned table that is not valid (`valid: false`, e.g.
 * created `ON ONLY` the table with an index of only some partitions attached)
 * is a fallback that keeps it so, reason `'invalid index'`, after the reasons
 * of the definition: the indexes of the partitions attached to it are created
 * from their own definitions, the index from its definition, `ON ONLY`
 * included, then each is attached with `ALTER INDEX … ATTACH PARTITION …`.
 *
 * The indexes of partitions keep their own settings (see
 * `partitionIndexSettings()`): their storage parameters when they differ from
 * the ones creating them gives them (the index's, unless they are made from
 * their own definitions), `CLUSTER ON` and `REPLICA IDENTITY USING INDEX` on
 * their partitions, reason `'partition index settings'`, and their comments,
 * reason `'comment on index'`, both last.
 *
 * @param index The index.
 * @param ctx The migration context.
 */
export function emitIndex(index: Index, ctx: EmitContext): Emitted {
  const table = qualifiedName(index.table);
  const invalid = index.valid === false;
  const named = invalid
    ? []
    : namedPartitionIndexes(index.partitionIndexes, 'idx');
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

  // The indexes of partitions made from their own definitions have their
  // own storage parameters; the others get those of the index.
  const partitions = partitionIndexSettings(
    index.partitionIndexes,
    (partitionIndex) =>
      invalid || named.includes(partitionIndex)
        ? (partitionIndex.options ?? [])
        : index.options
  );
  after.push(...partitions.statements);
  afterReasons.push(...partitions.reasons);

  const reasons = definitionReasons(index);
  if (invalid) {
    return withStatements(
      '',
      [...invalidIndexSql(index), ...after],
      [...reasons, 'invalid index', ...afterReasons]
    );
  }

  const before = named.map((partitionIndex) =>
    definitionSql(partitionIndex.definition)
  );
  const beforeReasons = before.length === 0 ? [] : ['partition index name'];
  if (reasons.length > 0) {
    return withStatements(
      '',
      [...before, definitionSql(index.definition), ...after],
      [...reasons, ...beforeReasons, ...afterReasons]
    );
  }

  const create = statement('createIndex', [
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

  return withStatements(
    [...before.map(sqlStatement), create].join('\n'),
    after,
    [...beforeReasons, ...afterReasons]
  );
}
