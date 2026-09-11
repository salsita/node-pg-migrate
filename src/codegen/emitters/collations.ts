import type { Collation } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'collation'`: `CREATE COLLATION <name> (…)`
 * built from the model, like pg_dump writes it: `provider`, then `locale`
 * (or `lc_collate` and `lc_ctype` for a libc collation whose two differ),
 * `deterministic = false` when it is not deterministic, and `rules` when
 * set.
 *
 * @param collation The collation.
 * @param ctx The migration context.
 */
export function emitCollation(
  _collation: Collation,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
