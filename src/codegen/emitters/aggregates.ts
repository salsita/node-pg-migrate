import type { Aggregate } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'aggregate'`: `CREATE AGGREGATE name(args) (…)`
 * built from the model (`pg_get_functiondef()` cannot write aggregates).
 *
 * @param aggregate The aggregate.
 * @param ctx The migration context.
 */
export function emitAggregate(
  _aggregate: Aggregate,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
