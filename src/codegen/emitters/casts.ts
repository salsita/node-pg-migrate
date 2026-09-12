import type { Cast } from '../../introspect/types';
import { array, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
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
export function emitCast(cast: Cast, ctx: EmitContext): Emitted {
  const fn = cast.method === 'function' ? cast.function : undefined;

  return {
    kind: 'code',
    code: statement('createCast', [
      str(cast.source),
      str(cast.target),
      object([
        ['functionName', fn === undefined ? undefined : nameCode(fn, ctx)],
        [
          'argumentTypes',
          fn === undefined ? undefined : array(cast.functionArguments.map(str)),
        ],
        ['inout', cast.method === 'inout' ? raw('true') : undefined],
        ['as', cast.context === 'EXPLICIT' ? undefined : str(cast.context)],
      ]),
    ]),
  };
}
