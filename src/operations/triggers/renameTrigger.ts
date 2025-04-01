import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameTriggerFn = (
  tableName: Name,
  oldTriggerName: string,
  newTriggerName: string
) => string;

export type RenameTrigger = Reversible<RenameTriggerFn>;

export function renameTrigger(mOptions: MigrationOptions): RenameTrigger {
  const _rename: RenameTrigger = (
    tableName,
    oldTriggerName,
    newTriggerName
  ) => {
    const oldTriggerNameStr = mOptions.literal(oldTriggerName);
    const tableNameStr = mOptions.literal(tableName);
    const newTriggerNameStr = mOptions.literal(newTriggerName);

    return `ALTER TRIGGER ${oldTriggerNameStr} ON ${tableNameStr} RENAME TO ${newTriggerNameStr};`;
  };

  _rename.reverse = (tableName, oldTriggerName, newTriggerName) =>
    _rename(tableName, newTriggerName, oldTriggerName);

  return _rename;
}
