import type { Schema } from '../../introspect/types';
import { object, raw, statement, str } from '../code';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createSchema(name, { ifNotExists: true })`. Never a fallback.
 *
 * @param schema The schema.
 * @param _ctx The migration context.
 */
export function emitSchema(schema: Schema, _ctx: EmitContext): Emitted {
  return {
    kind: 'code',
    code: statement('createSchema', [
      str(schema.name),
      object([['ifNotExists', raw('true')]]),
    ]),
  };
}
