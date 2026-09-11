import type { Routine } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createFunction(name, params, { returns, language, behavior,
 * security, onNull, parallel, window, set }, body)`, argument defaults as
 * `pgm.func(…)`.
 *
 * Fallback (`pg_get_functiondef`, `definition`) for a procedure, reason
 * `'procedure'`; a SQL-standard body, `'SQL-standard body'`; `LEAKPROOF`,
 * `'leakproof'`; a `COST` or `ROWS` that is not the default, `'cost or
 * rows'`.
 *
 * @param routine The function.
 * @param ctx The migration context.
 */
export function emitFunction(_routine: Routine, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
