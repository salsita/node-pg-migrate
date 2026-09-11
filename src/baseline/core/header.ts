import type { HeaderMeta } from '../types';

/**
 * Renders the comment header of a baseline migration: the `-- Up Migration`
 * marker, where the schema came from, how to record the migration on
 * databases that already have this schema, and, when they apply, notes about
 * materialized views and `max_locks_per_transaction`. It ends with a blank
 * line and has no timestamps, so the same input always renders the same
 * header.
 *
 * @param meta What the header says.
 */
export function renderHeader(_meta: HeaderMeta): string {
  throw new Error('not implemented');
}
