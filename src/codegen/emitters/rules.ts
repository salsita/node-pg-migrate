import type { Rule } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * Always a fallback, reason `'rule'`: `pg_get_ruledef` (`definition`), plus
 * `ALTER TABLE … DISABLE|ENABLE REPLICA|ENABLE ALWAYS RULE …` when the rule
 * is not enabled normally.
 *
 * @param rule The rule.
 * @param ctx The migration context.
 */
export function emitRule(_rule: Rule, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
