import type { Trigger } from '../../introspect/types';
import type { EmitContext, Emitted } from '../types';

/**
 * `pgm.createTrigger(table, name, { when, operation, level, function,
 * functionParams, condition, constraint, deferrable, deferred })`.
 *
 * Fallback (`pg_get_triggerdef`, `definition`) for `UPDATE OF` columns,
 * reason `'UPDATE OF columns'`, or transition tables, `'transition tables'`;
 * a trigger that is not enabled normally also gets `ALTER TABLE …
 * DISABLE|ENABLE REPLICA|ENABLE ALWAYS TRIGGER …`, reason `'firing mode'`.
 *
 * @param trigger The trigger.
 * @param ctx The migration context.
 */
export function emitTrigger(_trigger: Trigger, _ctx: EmitContext): Emitted {
  throw new Error('not implemented');
}
