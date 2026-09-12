import type { MaterializedView } from '../../introspect/types';
import { object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, storageParameters } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';
import { columnSettingsSql } from './tables';

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
 * The statistics targets, storage, compression and options of its columns
 * are set after it with `pgm.sql('ALTER MATERIALIZED VIEW … ALTER COLUMN …
 * SET …')`, which makes the step a fallback, reason `'column settings'`
 * (after the other reasons).
 *
 * @param view The materialized view.
 * @param ctx The migration context.
 */
export function emitMaterializedView(
  view: MaterializedView,
  ctx: EmitContext
): Emitted {
  const name = qualifiedName(view);
  const reasons: string[] = [];
  if (view.options.length > 0) {
    reasons.push('storage parameters');
  }

  if (view.accessMethod !== undefined) {
    reasons.push('access method');
  }

  const settings = view.columns.flatMap((column) =>
    columnSettingsSql(`MATERIALIZED VIEW ${name}`, column)
  );
  const settingsReasons = settings.length === 0 ? [] : ['column settings'];
  if (reasons.length > 0) {
    const using =
      view.accessMethod === undefined
        ? ''
        : ` USING ${quoteName(view.accessMethod)}`;
    const withOptions =
      view.options.length === 0
        ? ''
        : ` WITH (${storageParameters(view.options)})`;

    return withStatements(
      '',
      [
        `CREATE MATERIALIZED VIEW ${name}${using}${withOptions} AS ${view.definition} WITH NO DATA;`,
        ...settings,
      ],
      [...reasons, ...settingsReasons]
    );
  }

  return withStatements(
    statement('createMaterializedView', [
      nameCode(view, ctx),
      object([['data', raw('false')]]),
      str(view.definition),
    ]),
    settings,
    settingsReasons
  );
}
