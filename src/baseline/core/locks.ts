import type { DumpStats } from '../types';

/**
 * PostgreSQL's default `max_locks_per_transaction`.
 */
export const DEFAULT_MAX_LOCKS_PER_TRANSACTION = 64;

/**
 * Estimates how many relations, and so how many locks, the transaction of a
 * dump creates: tables and materialized views count three times (with their
 * TOAST table and its index), indexes, index-backed constraints, sequences
 * and views once.
 *
 * @param stats What the dump creates.
 */
export function estimateRelations(_stats: DumpStats): number {
  throw new Error('not implemented');
}

/**
 * The `max_locks_per_transaction` a server needs to create `relations`
 * relations in one transaction. The shared lock table has room for
 * `max_locks_per_transaction * (max_connections + max_prepared_transactions)`
 * locks; the result adds a 25% margin, is rounded up to a multiple of 64, and
 * is never below {@link DEFAULT_MAX_LOCKS_PER_TRANSACTION}.
 *
 * @param relations How many relations (see {@link estimateRelations}).
 * @param maxConnections The server's `max_connections`. Defaults to `100`.
 * @param maxPreparedTransactions The server's `max_prepared_transactions`.
 * Defaults to `0`.
 */
export function requiredMaxLocksPerTransaction(
  _relations: number,
  _maxConnections?: number,
  _maxPreparedTransactions?: number
): number {
  throw new Error('not implemented');
}
