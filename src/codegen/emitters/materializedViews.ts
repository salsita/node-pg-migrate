import type { MaterializedView } from '../../introspect/types';
import { object, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, storageParameters } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * `pgm.createMaterializedView(name, {}, definition)`: populated (`WITH
 * DATA`, the default), since the migration creates it from its query like
 * any other object.
 *
 * Fallback (`CREATE MATERIALIZED VIEW …` built from the model, populated
 * too) when it has storage parameters, reason `'storage parameters'`, or a
 * non-heap access method, `'access method'`.
 *
 * @param view The materialized view.
 * @param ctx The migration context.
 */
export function emitMaterializedView(
  view: MaterializedView,
  ctx: EmitContext
): Emitted {
  const reasons: string[] = [];
  if (view.options.length > 0) {
    reasons.push('storage parameters');
  }

  if (view.accessMethod !== undefined) {
    reasons.push('access method');
  }

  if (reasons.length > 0) {
    const using =
      view.accessMethod === undefined
        ? ''
        : ` USING ${quoteName(view.accessMethod)}`;
    const withOptions =
      view.options.length === 0
        ? ''
        : ` WITH (${storageParameters(view.options)})`;

    return emitFallback(
      `CREATE MATERIALIZED VIEW ${qualifiedName(view)}${using}${withOptions} AS ${view.definition};`,
      reasons.join(', ')
    );
  }

  return {
    kind: 'code',
    code: statement('createMaterializedView', [
      nameCode(view, ctx),
      object([]),
      str(view.definition),
    ]),
  };
}
