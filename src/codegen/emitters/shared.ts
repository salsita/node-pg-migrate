// Helpers that several emitters share.

import type { PartitionIndex } from '../../introspect/types';
import { makeObjectName } from '../sql';

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
