import type { MaterializedView } from '../../introspect/types';
import { object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, storageParameters } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * `pgm.createMaterializedView(name, { data: false }, definition)`:
 * unpopulated (`WITH NO DATA`), like pg_dump and the SQL baseline create
 * it, so that creating it never runs its query, which may need objects that
 * are created later (e.g. through a function whose body is a string); the
 * header says to refresh the materialized views after the first run.
 *
 * Fallback (`CREATE MATERIALIZED VIEW … WITH NO DATA` built from the model)
 * when it has storage parameters, reason `'storage parameters'`, or a
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
      `CREATE MATERIALIZED VIEW ${qualifiedName(view)}${using}${withOptions} AS ${view.definition} WITH NO DATA;`,
      reasons.join(', ')
    );
  }

  return {
    kind: 'code',
    code: statement('createMaterializedView', [
      nameCode(view, ctx),
      object([['data', raw('false')]]),
      str(view.definition),
    ]),
  };
}
