import type { Sequence } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createSequence(name, { type, increment, minvalue, maxvalue, start,
 * cache, cycle })`, leaving out the options that have their default value.
 *
 * Fallback (`CREATE [UNLOGGED] SEQUENCE …` built from the model) when the
 * sequence is unlogged, reason `'unlogged sequence'`, or when a value it has
 * to write is beyond `Number.MAX_SAFE_INTEGER`, reason `'bigint option'`.
 *
 * @param sequence The sequence.
 * @param ctx The migration context.
 */
export function emitSequence(_sequence: Sequence, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}

/**
 * `pgm.alterSequence(name, { owner: '<table>.<column>' })` for a sequence
 * with `ownedBy`. Never a fallback.
 *
 * @param sequence The owned sequence.
 * @param ctx The migration context.
 */
export function emitSequenceOwnership(
  _sequence: Sequence,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
