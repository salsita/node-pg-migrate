// Helpers that several emitters share.

import { parseQualifiedName } from '../../baseline/core/identifiers';
import type { PartitionIndex } from '../../introspect/types';
import {
  makeObjectName,
  qualifiedName,
  quoteIdentifier,
  quoteLiteral,
  quoteName,
  storageParameters,
} from '../sql';

/**
 * What PostgreSQL puts at the end of the name of an index it names itself:
 * `pkey` for a primary key, `key` for a unique constraint, `excl` for an
 * exclusion constraint, `idx` for any other index.
 */
export type IndexLabel = 'pkey' | 'key' | 'excl' | 'idx';

/**
 * The name PostgreSQL gives the index it creates for a partition when an
 * index of the partitioned table, or of its constraint, is created
 * (`ChooseIndexName()`): `<partition>_pkey` for a primary key, else
 * `<partition>_<columns>_<label>`, with the names of the index's columns
 * joined with `_`. (When that name is taken, it adds a number instead.)
 *
 * @param partitionIndex The index of the partition.
 * @param label The kind of index.
 */
export function partitionIndexName(
  partitionIndex: PartitionIndex,
  label: IndexLabel
): string {
  return makeObjectName(
    partitionIndex.table.name,
    label === 'pkey' ? undefined : partitionIndex.columns.join('_'),
    label
  );
}

/**
 * The indexes of partitions that have another name than the one PostgreSQL
 * would give them (see {@link partitionIndexName}): they must be created
 * before the index of their partitioned table, which then attaches them
 * instead of creating new ones. They come deepest first, so that each is
 * created after those of its own partitions.
 *
 * @param partitionIndexes The indexes of the partitions (see
 * `Index.partitionIndexes`).
 * @param label The kind of index.
 */
export function namedPartitionIndexes(
  partitionIndexes: ReadonlyArray<PartitionIndex> | undefined,
  label: IndexLabel
): PartitionIndex[] {
  return (partitionIndexes ?? []).filter(
    (partitionIndex) =>
      partitionIndex.name !== partitionIndexName(partitionIndex, label)
  );
}

/**
 * A `CREATE [UNIQUE] INDEX` statement of `pg_get_indexdef()` without the
 * `ONLY` of `ON ONLY`, which it writes for an index of a partitioned table.
 *
 * @param definition The statement.
 * @returns The statement without `ONLY`, or `undefined` when it has none.
 */
export function withoutOnly(definition: string): string | undefined {
  const prefix = ['CREATE UNIQUE INDEX ', 'CREATE INDEX '].find((start) =>
    definition.startsWith(start)
  );
  const name =
    prefix === undefined
      ? undefined
      : parseQualifiedName(definition, prefix.length);
  const only = ' ON ONLY ';
  if (name === undefined || !definition.startsWith(only, name.end)) {
    return undefined;
  }

  return `${definition.slice(0, name.end)} ON ${definition.slice(name.end + only.length)}`;
}

/**
 * The name of a storage parameter as stored (`name=value`).
 */
function parameterName(option: string): string {
  const equals = option.indexOf('=');

  return equals === -1 ? option : option.slice(0, equals);
}

/**
 * `ALTER INDEX … RESET (…)` for the storage parameters an index of a
 * partition gets once it is created and doesn't have, then `ALTER INDEX …
 * SET (…)` for those it has and doesn't get.
 *
 * @param index The index, schema-qualified and quoted.
 * @param own The storage parameters of the index (as stored).
 * @param given The storage parameters it has once it is created.
 */
function storageParameterSettings(
  index: string,
  own: ReadonlyArray<string>,
  given: ReadonlyArray<string>
): string[] {
  const settings: string[] = [];
  const ownNames = new Set(own.map(parameterName));
  const reset = given.map(parameterName).filter((name) => !ownNames.has(name));
  if (reset.length > 0) {
    settings.push(
      `ALTER INDEX ${index} RESET (${reset.map(quoteIdentifier).join(', ')});`
    );
  }

  const set = own.filter((option) => !given.includes(option));
  if (set.length > 0) {
    settings.push(`ALTER INDEX ${index} SET (${storageParameters(set)});`);
  }

  return settings;
}

/**
 * What the indexes of partitions still need once the index of their
 * partitioned table, or its constraint, has created or attached them, and
 * why:
 *
 * - their storage parameters, when they have other ones than creating them
 *   gives them (`created`): `ALTER INDEX … RESET (…)` for those they get and
 *   don't have, then `ALTER INDEX … SET (…)` (an index of a partitioned
 *   partition takes none of its own, so it is left as it is);
 * - `ALTER TABLE <partition> CLUSTER ON <index>` and `ALTER TABLE
 *   <partition> REPLICA IDENTITY USING INDEX <index>`;
 * - their comments (`COMMENT ON INDEX`).
 *
 * The reasons are `'partition index settings'` for the storage parameters,
 * clustering and replica identity, then `'comment on index'`.
 *
 * @param partitionIndexes The indexes of the partitions (see
 * `Index.partitionIndexes`).
 * @param created The storage parameters an index of a partition has once it
 * is created (as stored, e.g. `'fillfactor=70'`).
 */
export function partitionIndexSettings(
  partitionIndexes: ReadonlyArray<PartitionIndex> | undefined,
  created: (partitionIndex: PartitionIndex) => ReadonlyArray<string>
): { readonly statements: string[]; readonly reasons: string[] } {
  const settings: string[] = [];
  const comments: string[] = [];
  for (const partitionIndex of partitionIndexes ?? []) {
    const index = qualifiedName({
      schema: partitionIndex.table.schema,
      name: partitionIndex.name,
    });
    const table = qualifiedName(partitionIndex.table);
    if (withoutOnly(partitionIndex.definition) === undefined) {
      settings.push(
        ...storageParameterSettings(
          index,
          partitionIndex.options ?? [],
          created(partitionIndex)
        )
      );
    }

    if (partitionIndex.clustered === true) {
      settings.push(
        `ALTER TABLE ${table} CLUSTER ON ${quoteName(partitionIndex.name)};`
      );
    }

    if (partitionIndex.replicaIdentity === true) {
      settings.push(
        `ALTER TABLE ${table} REPLICA IDENTITY USING INDEX ${quoteName(partitionIndex.name)};`
      );
    }

    if (partitionIndex.comment !== undefined) {
      comments.push(
        `COMMENT ON INDEX ${index} IS ${quoteLiteral(partitionIndex.comment)};`
      );
    }
  }

  return {
    statements: [...settings, ...comments],
    reasons: [
      ...(settings.length === 0 ? [] : ['partition index settings']),
      ...(comments.length === 0 ? [] : ['comment on index']),
    ],
  };
}

/**
 * Whether an object literal with these keys, in this order, keeps them in
 * this order. JavaScript puts integer-like keys (`'0'`, `'42'`) first, in
 * numeric order, so `createTable` and `createType`, which read their columns
 * with `Object.keys()`, would reorder columns named that way.
 *
 * @param names The keys, in the wanted order.
 */
export function keepsKeyOrder(names: ReadonlyArray<string>): boolean {
  const keys = Object.keys(
    Object.fromEntries(names.map((name) => [name, true]))
  );

  return (
    keys.length === names.length &&
    keys.every((key, index) => key === names[index])
  );
}

/**
 * Whether a text has a line break, which the operations that write each
 * column or constraint on one line (`createTable`, `addConstraint`) turn
 * into a space, even inside a string constant.
 *
 * @param text The text.
 */
export function hasLineBreak(text: string): boolean {
  return text.includes('\n') || text.includes('\r');
}
