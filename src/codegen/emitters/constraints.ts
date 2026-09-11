import type { Constraint } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.addConstraint(table, name, definition)`, the definition as
 * `pg_get_constraintdef()` wrote it.
 *
 * Fallback when the table is clustered on the constraint's index or uses it
 * as its replica identity: the constraint is added, then `pgm.sql('ALTER
 * TABLE … CLUSTER ON …')` / `pgm.sql('ALTER TABLE … REPLICA IDENTITY USING
 * INDEX …')`, reason `'CLUSTER ON'` / `'replica identity'`.
 *
 * @param constraint The constraint.
 * @param ctx The migration context.
 */
export function emitConstraint(
  _constraint: Constraint,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
