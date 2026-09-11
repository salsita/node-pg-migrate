import type { RangeType } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'range type'`: `CREATE TYPE … AS RANGE (…)`
 * built from the model (`subtype`, and `subtype_opclass`, `collation`,
 * `canonical`, `subtype_diff`, `multirange_type_name` when they are not the
 * defaults).
 *
 * @param range The range type.
 * @param ctx The migration context.
 */
export function emitRange(_range: RangeType, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
