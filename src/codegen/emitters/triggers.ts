import type { FiringMode, Trigger } from '../../introspect/types';
import { array, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteName, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { withStatements } from './fallback';

/**
 * The `ALTER TABLE` action that gives a trigger or rule its firing mode, for
 * the modes other than the default `'ORIGIN'`.
 */
export const FIRING_ACTIONS: Readonly<
  Record<Exclude<FiringMode, 'ORIGIN'>, string>
> = {
  DISABLED: 'DISABLE',
  REPLICA: 'ENABLE REPLICA',
  ALWAYS: 'ENABLE ALWAYS',
};

/**
 * Whether a constraint trigger names the table its constraint references
 * (`FROM <table>`), which `createTrigger` cannot write: `pg_get_triggerdef()`
 * writes it right before `[NOT] DEFERRABLE INITIALLY`.
 */
function hasReferencedTable(trigger: Trigger): boolean {
  if (!trigger.constraint) {
    return false;
  }

  const deferrable = trigger.definition.indexOf(' DEFERRABLE INITIALLY ');

  return (
    deferrable !== -1 &&
    trigger.definition.slice(0, deferrable).includes(' FROM ')
  );
}

/**
 * `pgm.createTrigger(table, name, { when, operation, level, function,
 * functionParams, condition, constraint, deferrable, deferred })`.
 *
 * Fallback (`pg_get_triggerdef`, `definition`) for `UPDATE OF` columns,
 * reason `'UPDATE OF columns'`, or transition tables, `'transition tables'`;
 * a trigger that is not enabled normally also gets `ALTER TABLE …
 * DISABLE|ENABLE REPLICA|ENABLE ALWAYS TRIGGER …`, reason `'firing mode'`; a
 * constraint trigger with `FROM <referenced table>`, reason `'referenced
 * table'`, is created with `pg_get_triggerdef` too.
 *
 * @param trigger The trigger.
 * @param ctx The migration context.
 */
export function emitTrigger(trigger: Trigger, ctx: EmitContext): Emitted {
  const reasons: string[] = [];
  if (trigger.updateOf.length > 0) {
    reasons.push('UPDATE OF columns');
  }

  if (trigger.oldTable !== undefined || trigger.newTable !== undefined) {
    reasons.push('transition tables');
  }

  const referenced = hasReferencedTable(trigger);
  const fromDefinition = reasons.length > 0 || referenced;
  const after: string[] = [];
  if (trigger.enabled !== 'ORIGIN') {
    reasons.push('firing mode');
    after.push(
      `ALTER TABLE ${qualifiedName(trigger.table)} ${FIRING_ACTIONS[trigger.enabled]} TRIGGER ${quoteName(trigger.name)};`
    );
  }

  if (referenced) {
    reasons.push('referenced table');
  }

  if (fromDefinition) {
    return withStatements(
      '',
      [terminated(trigger.definition), ...after],
      reasons
    );
  }

  const code = statement('createTrigger', [
    nameCode(trigger.table, ctx),
    str(trigger.name),
    object([
      ['when', str(trigger.timing)],
      [
        'operation',
        trigger.events.length === 1
          ? str(trigger.events[0])
          : array(trigger.events.map(str)),
      ],
      ['level', str(trigger.level)],
      ['function', nameCode(trigger.function, ctx)],
      [
        'functionParams',
        trigger.args.length === 0 ? undefined : array(trigger.args.map(str)),
      ],
      [
        'condition',
        trigger.condition === undefined ? undefined : str(trigger.condition),
      ],
      ['constraint', trigger.constraint ? raw('true') : undefined],
      ['deferrable', trigger.deferrable ? raw('true') : undefined],
      ['deferred', trigger.deferred ? raw('true') : undefined],
    ]),
  ]);

  return withStatements(code, after, reasons);
}
