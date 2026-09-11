import type { Operator } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createOperator(name, { procedure, left, right, commutator, negator,
 * restrict, join, hashes, merges })`, every type and function given by its
 * schema and stored name (see {@link Operator}).
 *
 * `createOperator` writes the operator's name, commutator and negator
 * without quotes, and PostgreSQL only takes a schema-qualified commutator or
 * negator as `OPERATOR(schema.op)`. So the operator is a fallback
 * (`CREATE OPERATOR …` built from the model) when its schema is not the
 * migration's default schema and needs quotes, reason `'operator schema'`,
 * or when its commutator or negator is not in the migration's default
 * schema, reason `'commutator or negator'`.
 *
 * @param operator The operator.
 * @param ctx The migration context.
 */
export function emitOperator(_operator: Operator, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
