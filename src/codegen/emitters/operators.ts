import type { Operator, SchemaQualifiedName } from '../../introspect/types';
import type { Code } from '../code';
import { object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteIdentifier, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * An operator (the operator itself, its commutator or its negator) as
 * `createOperator` takes it: always a `{ name }` object, so that it writes
 * the symbol as it is (a string name would be wrapped in parentheses when it
 * looks like an expression, e.g. `@>`), with the schema when it is not the
 * default schema.
 */
function operatorName(name: SchemaQualifiedName, ctx: EmitContext): Code {
  return object([
    [
      'schema',
      name.schema === ctx.defaultSchema ? undefined : str(name.schema),
    ],
    ['name', str(name.name)],
  ]);
}

/**
 * An operator in SQL: `"schema".symbol`.
 */
function operatorSql(name: SchemaQualifiedName): string {
  return `${quoteName(name.schema)}.${name.name}`;
}

/**
 * `CREATE OPERATOR` built from the model, with the commutator and negator as
 * `OPERATOR(schema.op)`.
 */
function createOperatorSql(operator: Operator): string {
  const settings = [`FUNCTION = ${qualifiedName(operator.function)}`];
  if (operator.left !== undefined) {
    settings.push(`LEFTARG = ${qualifiedName(operator.left)}`);
  }

  settings.push(`RIGHTARG = ${qualifiedName(operator.right)}`);
  if (operator.commutator !== undefined) {
    settings.push(`COMMUTATOR = OPERATOR(${operatorSql(operator.commutator)})`);
  }

  if (operator.negator !== undefined) {
    settings.push(`NEGATOR = OPERATOR(${operatorSql(operator.negator)})`);
  }

  if (operator.restrict !== undefined) {
    settings.push(`RESTRICT = ${qualifiedName(operator.restrict)}`);
  }

  if (operator.join !== undefined) {
    settings.push(`JOIN = ${qualifiedName(operator.join)}`);
  }

  if (operator.hashes) {
    settings.push('HASHES');
  }

  if (operator.merges) {
    settings.push('MERGES');
  }

  return `CREATE OPERATOR ${operatorSql(operator)} (${settings.join(', ')});`;
}

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
 * The operator, its commutator and its negator are given as `{ name }`
 * objects (with `schema` outside the default schema): `createOperator`
 * would wrap a plain string that looks like an expression, such as `@>`, in
 * parentheses.
 *
 * @param operator The operator.
 * @param ctx The migration context.
 */
export function emitOperator(operator: Operator, ctx: EmitContext): Emitted {
  const reasons: string[] = [];
  if (
    operator.schema !== ctx.defaultSchema &&
    quoteIdentifier(operator.schema) !== operator.schema
  ) {
    reasons.push('operator schema');
  }

  if (
    [operator.commutator, operator.negator].some(
      (other) => other !== undefined && other.schema !== ctx.defaultSchema
    )
  ) {
    reasons.push('commutator or negator');
  }

  if (reasons.length > 0) {
    return emitFallback(createOperatorSql(operator), reasons.join(', '));
  }

  const optional = (
    name: SchemaQualifiedName | undefined,
    code: (name: SchemaQualifiedName) => Code
  ): Code | undefined => (name === undefined ? undefined : code(name));
  const named = (name: SchemaQualifiedName): Code => nameCode(name, ctx);
  const symbol = (name: SchemaQualifiedName): Code => operatorName(name, ctx);

  return {
    kind: 'code',
    code: statement('createOperator', [
      operatorName(operator, ctx),
      object([
        ['procedure', named(operator.function)],
        ['left', optional(operator.left, named)],
        ['right', named(operator.right)],
        ['commutator', optional(operator.commutator, symbol)],
        ['negator', optional(operator.negator, symbol)],
        ['restrict', optional(operator.restrict, named)],
        ['join', optional(operator.join, named)],
        ['hashes', operator.hashes ? raw('true') : undefined],
        ['merges', operator.merges ? raw('true') : undefined],
      ]),
    ]),
  };
}
