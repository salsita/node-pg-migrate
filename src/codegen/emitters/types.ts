import type { ShellType } from '../../introspect/types';
import { qualifiedName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * Always a fallback, reason `'shell type'`: `pgm.sql('CREATE TYPE
 * "schema"."name";')`, which declares the type without a definition; no
 * `pgm` operation does.
 *
 * @param type The shell type.
 * @param _ctx The migration context.
 */
export function emitShellType(type: ShellType, _ctx: EmitContext): Emitted {
  return emitFallback(`CREATE TYPE ${qualifiedName(type)};`, 'shell type');
}
