import type { CompositeType } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createType(name, { attribute: 'type', … })`, with the attributes in
 * order.
 *
 * Fallback (`CREATE TYPE … AS (…)` built from the model) when an attribute
 * has a collation, reason `'attribute collation'`.
 *
 * @param type The composite type.
 * @param ctx The migration context.
 */
export function emitComposite(
  _type: CompositeType,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
