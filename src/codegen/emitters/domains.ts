import type { DomainType } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createDomain(name, baseType, { default, notNull, check,
 * constraintName, collation })`, the default as `pgm.func(…)`.
 *
 * `createDomain` takes at most one constraint (a `NOT NULL` or one CHECK,
 * valid): the other constraints are added with `pgm.sql('ALTER DOMAIN … ADD
 * CONSTRAINT …')` after it, which makes the step a fallback, reason
 * `'several constraints'`.
 *
 * @param domain The domain.
 * @param ctx The migration context.
 */
export function emitDomain(_domain: DomainType, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
