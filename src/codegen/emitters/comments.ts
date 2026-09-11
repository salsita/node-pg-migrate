import type { ObjectComment } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'comment on <object type>'` (the object type of
 * the statement in lower case, e.g. `'comment on view'`, `'comment on
 * column'`): `pgm.sql('COMMENT ON <object type> <object> IS <text>')` with
 * schema-qualified, quoted names, e.g. `COMMENT ON FUNCTION
 * "kitchen"."customer_order_total"(p_customer_id bigint) IS …` (the
 * `identityArguments`; `(*)` for an aggregate without arguments),
 * `COMMENT ON PROCEDURE …` for a procedure, `COMMENT ON OPERATOR
 * "kitchen".=~= (numeric, numeric) IS …` (the operator's
 * `identityArguments`), `COMMENT ON CAST (character varying AS integer) IS
 * …`, `COMMENT ON CONSTRAINT "c" ON DOMAIN "public"."d" IS …` or `COMMENT ON
 * INDEX "public"."t_pkey" IS …` for the index of a constraint.
 *
 * @param comment The comment and what it is on.
 * @param ctx The migration context.
 */
export function emitComment(
  _comment: ObjectComment,
  _ctx: EmitContext
): Emitted {
  throw new Error('not implemented');
}
