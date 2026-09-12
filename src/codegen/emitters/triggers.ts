import type {
  FiringMode,
  PartitionTrigger,
  Trigger,
} from '../../introspect/types';
import { array, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { qualifiedName, quoteLiteral, quoteName, terminated } from '../sql';
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
 * The `ALTER TABLE` action that gives a clone of a trigger on a partition any
 * firing mode, `'ORIGIN'` included.
 */
const CLONE_FIRING_ACTIONS: Readonly<Record<FiringMode, string>> = {
  ORIGIN: 'ENABLE',
  ...FIRING_ACTIONS,
};

/**
 * The statements that give the clones of a trigger on partitions their own
 * firing mode and comments, which creating the trigger does not give them:
 * `ALTER TABLE <partition> DISABLE|ENABLE|ENABLE REPLICA|ENABLE ALWAYS
 * TRIGGER <name>` for a clone that fires unlike the trigger it is a clone of
 * (the statement also changes the clones below it, so it comes before
 * theirs), and `COMMENT ON TRIGGER <name> ON <partition>`.
 */
function cloneSql(trigger: Trigger): {
  readonly firing: string[];
  readonly comments: string[];
} {
  const name = quoteName(trigger.name);
  const firing: string[] = [];
  const comments: string[] = [];
  const visit = (
    clones: ReadonlyArray<PartitionTrigger> | undefined,
    inherited: FiringMode
  ): void => {
    for (const clone of clones ?? []) {
      const table = qualifiedName(clone.table);
      if (clone.enabled !== inherited) {
        firing.push(
          `ALTER TABLE ${table} ${CLONE_FIRING_ACTIONS[clone.enabled]} TRIGGER ${name};`
        );
      }

      if (clone.comment !== undefined) {
        comments.push(
          `COMMENT ON TRIGGER ${name} ON ${table} IS ${quoteLiteral(clone.comment)};`
        );
      }

      visit(clone.partitionTriggers, clone.enabled);
    }
  };
  visit(trigger.partitionTriggers, trigger.enabled);

  return { firing, comments };
}

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
 * DISABLE|ENABLE REPLICA|ENABLE ALWAYS TRIGGER …`, reason `'firing mode'`,
 * and so does each clone on a partition (`partitionTriggers`) that fires
 * unlike the trigger it is a clone of, after it; a constraint trigger with
 * `FROM <referenced table>`, reason `'referenced table'`, is created with
 * `pg_get_triggerdef` too. The comments on clones are set last, with
 * `COMMENT ON TRIGGER … ON <partition>`, reason `'comment on trigger'`.
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
    after.push(
      `ALTER TABLE ${qualifiedName(trigger.table)} ${FIRING_ACTIONS[trigger.enabled]} TRIGGER ${quoteName(trigger.name)};`
    );
  }

  const clones = cloneSql(trigger);
  after.push(...clones.firing);
  if (trigger.enabled !== 'ORIGIN' || clones.firing.length > 0) {
    reasons.push('firing mode');
  }

  if (referenced) {
    reasons.push('referenced table');
  }

  after.push(...clones.comments);
  if (clones.comments.length > 0) {
    reasons.push('comment on trigger');
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
