import type { Statistics } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'extended statistics'`:
 * `pg_get_statisticsobjdef` (`definition`), plus `ALTER STATISTICS … SET
 * STATISTICS …` when `statisticsTarget` is set.
 *
 * @param statistics The statistics object.
 * @param ctx The migration context.
 */
export function emitStatistics(
  _statistics: Statistics,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
