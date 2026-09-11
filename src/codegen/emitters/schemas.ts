import type { Schema } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createSchema(name, { ifNotExists: true })`. Never a fallback.
 *
 * @param schema The schema.
 * @param ctx The migration context.
 */
export function emitSchema(_schema: Schema, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
