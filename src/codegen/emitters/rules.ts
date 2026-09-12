import type { Rule } from '../../introspect/types';
import { qualifiedName, quoteName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';
import { FIRING_ACTIONS } from './triggers';

/**
 * Always a fallback, reason `'rule'`: `pg_get_ruledef` (`definition`), plus
 * `ALTER TABLE … DISABLE|ENABLE REPLICA|ENABLE ALWAYS RULE …` when the rule
 * is not enabled normally.
 *
 * @param rule The rule.
 * @param _ctx The migration context.
 */
export function emitRule(rule: Rule, _ctx: EmitContext): Emitted {
  return withStatements(
    '',
    [
      terminated(rule.definition),
      ...(rule.enabled === 'ORIGIN'
        ? []
        : [
            `ALTER TABLE ${qualifiedName(rule.table)} ${FIRING_ACTIONS[rule.enabled]} RULE ${quoteName(rule.name)};`,
          ]),
    ],
    ['rule']
  );
}
