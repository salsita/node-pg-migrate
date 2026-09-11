import type { Extension } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createExtension(name, { ifNotExists: true, schema })`. Never a
 * fallback.
 *
 * @param extension The extension.
 * @param ctx The migration context.
 */
export function emitExtension(
  _extension: Extension,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
