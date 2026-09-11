import type { Table } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.alterTable(table, { levelSecurity: 'ENABLE' })` when row-level
 * security is enabled, then `pgm.alterTable(table, { levelSecurity: 'FORCE'
 * })` when it is forced. Never a fallback.
 *
 * @param table A table with row-level security enabled or forced.
 * @param ctx The migration context.
 */
export function emitRowLevelSecurity(
  _table: Table,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
