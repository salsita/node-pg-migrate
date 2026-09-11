import type { MaterializedView } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createMaterializedView(name, {}, definition)`.
 *
 * Fallback (`CREATE MATERIALIZED VIEW …` built from the model) when it has
 * storage parameters, reason `'storage parameters'`, or a non-heap access
 * method, `'access method'`.
 *
 * @param view The materialized view.
 * @param ctx The migration context.
 */
export function emitMaterializedView(
  _view: MaterializedView,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
