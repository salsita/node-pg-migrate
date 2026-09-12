import type { DomainCheck, DomainType } from '../../introspect/types';
import type { Code } from '../code';
import { func, isEmpty, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { makeObjectName, qualifiedName, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';

/**
 * The constraint options of `createDomain`: the `NOT NULL` of the domain
 * (with its name when it is not the default `<domain>_not_null`), or else
 * its first valid CHECK.
 */
function constraintOptions(
  domain: DomainType,
  first: DomainCheck | undefined
): Array<readonly [string, Code]> {
  if (domain.notNull) {
    const name = domain.notNullConstraintName;

    return [
      ['notNull', raw('true')],
      ...(name === undefined ||
      name === makeObjectName(domain.name, undefined, 'not_null')
        ? []
        : [['constraintName', str(name)] as const]),
    ];
  }

  return first === undefined
    ? []
    : [
        ['check', str(first.expression)],
        ['constraintName', str(first.name)],
      ];
}

/**
 * `pgm.createDomain(name, baseType, { default, notNull, check,
 * constraintName, collation })`, the default as `pgm.func(…)`.
 *
 * `createDomain` takes at most one constraint (a `NOT NULL` or one CHECK,
 * valid): the other constraints are added with `pgm.sql('ALTER DOMAIN … ADD
 * CONSTRAINT …')` after it, which makes the step a fallback, reason
 * `'several constraints'` when the domain has more than one, and `'NOT
 * VALID constraint'` when a CHECK is not valid (`createDomain` would validate
 * it), so `ALTER DOMAIN … ADD CONSTRAINT … NOT VALID` adds it.
 *
 * @param domain The domain.
 * @param ctx The migration context.
 */
export function emitDomain(domain: DomainType, ctx: EmitContext): Emitted {
  const first = domain.notNull
    ? undefined
    : domain.checks.find((check) => check.validated);
  const added = domain.checks.filter((check) => check !== first);
  const reasons: string[] = [];
  if (domain.checks.length + (domain.notNull ? 1 : 0) > 1) {
    reasons.push('several constraints');
  }

  if (added.some((check) => !check.validated)) {
    reasons.push('NOT VALID constraint');
  }

  const options = object([
    [
      'collation',
      domain.collation === undefined ? undefined : str(domain.collation),
    ],
    [
      'default',
      domain.default === undefined ? undefined : func(domain.default),
    ],
    ...constraintOptions(domain, first),
  ]);
  const code = statement('createDomain', [
    nameCode(domain, ctx),
    str(domain.baseType),
    ...(isEmpty(options) ? [] : [options]),
  ]);

  return withStatements(
    code,
    added.map(
      (check) =>
        `ALTER DOMAIN ${qualifiedName(domain)} ADD CONSTRAINT ${quoteName(check.name)} CHECK (${check.expression})${check.validated ? '' : ' NOT VALID'};`
    ),
    reasons
  );
}
