import type { RangeType } from '../../introspect/types';
import { defaultMultirangeName, qualifiedName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * Always a fallback, reason `'range type'`: `CREATE TYPE … AS RANGE (…)`
 * built from the model (`subtype`, and `subtype_opclass`, `collation`,
 * `canonical`, `subtype_diff`, `multirange_type_name` when they are not the
 * defaults).
 *
 * @param range The range type.
 * @param _ctx The migration context.
 */
export function emitRange(range: RangeType, _ctx: EmitContext): Emitted {
  const settings = [`subtype = ${range.subtype}`];
  if (range.subtypeOpclass !== undefined) {
    settings.push(`subtype_opclass = ${range.subtypeOpclass}`);
  }

  if (range.collation !== undefined) {
    settings.push(`collation = ${range.collation}`);
  }

  if (range.canonical !== undefined) {
    settings.push(`canonical = ${range.canonical}`);
  }

  if (range.subtypeDiff !== undefined) {
    settings.push(`subtype_diff = ${range.subtypeDiff}`);
  }

  if (
    range.multirange.schema !== range.schema ||
    range.multirange.name !== defaultMultirangeName(range.name)
  ) {
    settings.push(`multirange_type_name = ${qualifiedName(range.multirange)}`);
  }

  return emitFallback(
    `CREATE TYPE ${qualifiedName(range)} AS RANGE (${settings.join(', ')});`,
    'range type'
  );
}
