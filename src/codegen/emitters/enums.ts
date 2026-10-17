import type { EnumType } from '../../introspect/types';
import { array, statement, str } from '../code';
import { nameCode } from '../names';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createType(name, [labels])`, with the labels in order. Never a
 * fallback.
 *
 * @param type The enum type.
 * @param ctx The migration context.
 */
export function emitEnum(type: EnumType, ctx: EmitContext): Emitted {
  return {
    kind: 'code',
    code: statement('createType', [
      nameCode(type, ctx),
      array(type.labels.map(str)),
    ]),
  };
}
