import type { Policy } from '../../introspect/types';
import { array, object, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteIdentifier, quoteName } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * A role of `TO …`: `PUBLIC` as it is, a role name quoted when it needs
 * quotes (`createPolicy` writes roles as they are).
 */
function roleSql(role: string): string {
  return role === 'PUBLIC' ? role : quoteIdentifier(role);
}

/**
 * `pgm.createPolicy(table, name, { command, role, using, check })`, leaving
 * out the defaults (`ALL` commands, `PUBLIC`).
 *
 * Fallback (`CREATE POLICY … AS RESTRICTIVE …` built from the model) for a
 * restrictive policy, reason `'restrictive policy'`.
 *
 * @param policy The policy.
 * @param ctx The migration context.
 */
export function emitPolicy(policy: Policy, ctx: EmitContext): Emitted {
  const roles = policy.roles.map(roleSql);
  if (!policy.permissive) {
    const using = policy.using === undefined ? '' : ` USING (${policy.using})`;
    const check =
      policy.check === undefined ? '' : ` WITH CHECK (${policy.check})`;

    return emitFallback(
      `CREATE POLICY ${quoteName(policy.name)} ON ${qualifiedName(policy.table)} AS RESTRICTIVE FOR ${policy.command} TO ${roles.join(', ')}${using}${check};`,
      'restrictive policy'
    );
  }

  const publicOnly = roles.length === 1 && roles[0] === 'PUBLIC';
  const roleCode = roles.length === 1 ? str(roles[0]) : array(roles.map(str));

  return {
    kind: 'code',
    code: statement('createPolicy', [
      nameCode(policy.table, ctx),
      str(policy.name),
      object([
        ['command', policy.command === 'ALL' ? undefined : str(policy.command)],
        ['role', publicOnly ? undefined : roleCode],
        ['using', policy.using === undefined ? undefined : str(policy.using)],
        ['check', policy.check === undefined ? undefined : str(policy.check)],
      ]),
    ]),
  };
}
