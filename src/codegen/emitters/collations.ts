import type { Collation } from '../../introspect/types';
import { qualifiedName, quoteLiteral } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * Always a fallback, reason `'collation'`: `CREATE COLLATION <name> (…)`
 * built from the model, like pg_dump writes it: `provider`, then `locale`
 * (or `lc_collate` and `lc_ctype` for a libc collation whose two differ),
 * `deterministic = false` when it is not deterministic, and `rules` when
 * set.
 *
 * @param collation The collation.
 * @param _ctx The migration context.
 */
export function emitCollation(
  collation: Collation,
  _ctx: EmitContext
): Emitted {
  const settings = [`provider = ${collation.provider}`];
  const { lcCollate, lcCtype, locale } = collation;
  if (
    lcCollate !== undefined &&
    lcCtype !== undefined &&
    lcCollate !== lcCtype
  ) {
    settings.push(
      `lc_collate = ${quoteLiteral(lcCollate)}`,
      `lc_ctype = ${quoteLiteral(lcCtype)}`
    );
  } else {
    const single = locale ?? lcCollate ?? lcCtype;
    if (single !== undefined) {
      settings.push(`locale = ${quoteLiteral(single)}`);
    }
  }

  if (!collation.deterministic) {
    settings.push('deterministic = false');
  }

  if (collation.rules !== undefined) {
    settings.push(`rules = ${quoteLiteral(collation.rules)}`);
  }

  return emitFallback(
    `CREATE COLLATION ${qualifiedName(collation)} (${settings.join(', ')});`,
    'collation'
  );
}
