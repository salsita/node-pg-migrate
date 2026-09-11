import type { EnumType } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createType(name, [labels])`, with the labels in order. Never a
 * fallback.
 *
 * @param type The enum type.
 * @param ctx The migration context.
 */
export function emitEnum(_type: EnumType, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
