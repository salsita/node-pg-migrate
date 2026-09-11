import type { Cast } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createCast(source, target, { functionName, argumentTypes, inout, as
 * })`: `functionName` and `argumentTypes` for a `'function'` cast, `inout:
 * true` for an `'inout'` one, neither for a `'binary'` one (`WITHOUT
 * FUNCTION`), and `as` unless the context is `'EXPLICIT'`.
 *
 * Fallback (`CREATE CAST …` built from the model), reason `'cast'`, only for
 * a cast that the options cannot express; none is known, since every
 * `castmethod` and `castcontext` has an option.
 *
 * @param cast The cast.
 * @param ctx The migration context.
 */
export function emitCast(_cast: Cast, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
