import type { Extension } from '../../introspect/types';
import { object, raw, statement, str } from '../code';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createExtension(name, { ifNotExists: true, schema })`. Never a
 * fallback.
 *
 * The schema is always given, also when it is the migration's default
 * schema: `CREATE EXTENSION` without `SCHEMA` would use the first schema of
 * the `search_path` the migration runs with.
 *
 * @param extension The extension.
 * @param _ctx The migration context.
 */
export function emitExtension(
  extension: Extension,
  _ctx: EmitContext
): Emitted {
  return {
    kind: 'code',
    code: statement('createExtension', [
      str(extension.name),
      object([
        ['ifNotExists', raw('true')],
        ['schema', str(extension.schema)],
      ]),
    ]),
  };
}
