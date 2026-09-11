import type { Policy } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createPolicy(table, name, { command, role, using, check })`.
 *
 * Fallback (`CREATE POLICY … AS RESTRICTIVE …` built from the model) for a
 * restrictive policy, reason `'restrictive policy'`.
 *
 * @param policy The policy.
 * @param ctx The migration context.
 */
export function emitPolicy(_policy: Policy, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
