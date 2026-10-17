import type { Statistics } from '../../introspect/types';
import { qualifiedName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';

/**
 * Always a fallback, reason `'extended statistics'`:
 * `pg_get_statisticsobjdef` (`definition`), plus `ALTER STATISTICS … SET
 * STATISTICS …` when `statisticsTarget` is set.
 *
 * @param statistics The statistics object.
 * @param _ctx The migration context.
 */
export function emitStatistics(
  statistics: Statistics,
  _ctx: EmitContext
): Emitted {
  return withStatements(
    '',
    [
      terminated(statistics.definition),
      ...(statistics.statisticsTarget === undefined
        ? []
        : [
            `ALTER STATISTICS ${qualifiedName(statistics)} SET STATISTICS ${String(statistics.statisticsTarget)};`,
          ]),
    ],
    ['extended statistics']
  );
}
