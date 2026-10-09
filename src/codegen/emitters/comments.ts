import type { ObjectComment } from '../../introspect/types';
import { qualifiedName, quoteLiteral, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * The object type of a `COMMENT ON` statement (as the reason writes it, in
 * lower case) and the object, as SQL.
 */
interface CommentTarget {
  readonly type: string;
  readonly object: string;
}

/**
 * The object type of a comment on an object that is written `<TYPE>
 * "schema"."name"`, e.g. `TYPE` for an enum, a shell type, a composite or a
 * range type.
 */
const QUALIFIED_TYPES: Readonly<Record<string, string>> = {
  enum: 'type',
  shellType: 'type',
  composite: 'type',
  range: 'type',
  domain: 'domain',
  collation: 'collation',
  sequence: 'sequence',
  index: 'index',
  view: 'view',
  materializedView: 'materialized view',
  statistics: 'statistics',
};

/**
 * The object type and the object of a comment on an object.
 */
function objectTarget(
  object: Extract<ObjectComment, { on: 'object' }>['object']
): CommentTarget {
  if (object.kind === 'schema') {
    return { type: 'schema', object: quoteName(object.name) };
  }

  if (object.kind === 'cast') {
    return { type: 'cast', object: `(${object.source} AS ${object.target})` };
  }

  if (object.kind === 'function') {
    return {
      type: object.routineKind === 'procedure' ? 'procedure' : 'function',
      object: `${qualifiedName(object)}(${object.identityArguments})`,
    };
  }

  if (object.kind === 'aggregate') {
    const args =
      object.identityArguments === '' ? '*' : object.identityArguments;

    return { type: 'aggregate', object: `${qualifiedName(object)}(${args})` };
  }

  if (object.kind === 'operator') {
    return {
      type: 'operator',
      object: `${quoteName(object.schema)}.${object.name} (${object.identityArguments})`,
    };
  }

  if (
    object.kind === 'constraint' ||
    object.kind === 'trigger' ||
    object.kind === 'policy' ||
    object.kind === 'rule'
  ) {
    return {
      type: object.kind,
      object: `${quoteName(object.name)} ON ${qualifiedName(object.table)}`,
    };
  }

  return { type: QUALIFIED_TYPES[object.kind], object: qualifiedName(object) };
}

function commentTarget(comment: ObjectComment): CommentTarget {
  if (comment.on === 'object') {
    return objectTarget(comment.object);
  }

  if (comment.on === 'column') {
    return {
      type: 'column',
      object: `${qualifiedName(comment.object)}.${quoteName(comment.column)}`,
    };
  }

  if (comment.on === 'domainConstraint') {
    return {
      type: 'constraint',
      object: `${quoteName(comment.constraint)} ON DOMAIN ${qualifiedName(comment.object)}`,
    };
  }

  // The index of a constraint has the constraint's name.
  return { type: 'index', object: qualifiedName(comment.object) };
}

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
 * @param _ctx The migration context.
 */
export function emitComment(
  comment: ObjectComment,
  _ctx: EmitContext
): Emitted {
  const { type, object } = commentTarget(comment);

  return emitFallback(
    `COMMENT ON ${type.toUpperCase()} ${object} IS ${quoteLiteral(comment.text)};`,
    `comment on ${type}`
  );
}
