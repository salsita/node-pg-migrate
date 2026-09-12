import type { CompositeType } from '../../introspect/types';
import { object, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';
import { keepsKeyOrder } from './shared';

/**
 * `pgm.createType(name, { attribute: 'type', … })`, with the attributes in
 * order.
 *
 * Fallback (`CREATE TYPE … AS (…)` built from the model) when an attribute
 * has a collation, reason `'attribute collation'`; or when the attributes
 * would not keep their order as the keys of an object (integer-like names
 * such as `'1'` come first), reason `'attribute order'`.
 *
 * @param type The composite type.
 * @param ctx The migration context.
 */
export function emitComposite(type: CompositeType, ctx: EmitContext): Emitted {
  const reasons: string[] = [];
  if (type.attributes.some((attribute) => attribute.collation !== undefined)) {
    reasons.push('attribute collation');
  }

  if (!keepsKeyOrder(type.attributes.map((attribute) => attribute.name))) {
    reasons.push('attribute order');
  }

  if (reasons.length > 0) {
    const attributes = type.attributes.map(
      (attribute) =>
        `${quoteName(attribute.name)} ${attribute.type}${attribute.collation === undefined ? '' : ` COLLATE ${attribute.collation}`}`
    );

    return emitFallback(
      terminated(
        `CREATE TYPE ${qualifiedName(type)} AS (${attributes.join(', ')})`
      ),
      reasons.join(', ')
    );
  }

  return {
    kind: 'code',
    code: statement('createType', [
      nameCode(type, ctx),
      object(
        type.attributes.map((attribute) => [
          attribute.name,
          str(attribute.type),
        ])
      ),
    ]),
  };
}
