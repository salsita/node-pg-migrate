import type { MigrationOptions } from '../../types';
import type { DropOptions, Name } from '../generalTypes';

export type DropTrigger = (
  tableName: Name,
  triggerName: string,
  dropOptions?: DropOptions
) => string | string[];

export function dropTrigger(mOptions: MigrationOptions): DropTrigger {
  const _drop: DropTrigger = (tableName, triggerName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const triggerNameStr = mOptions.literal(triggerName);
    const tableNameStr = mOptions.literal(tableName);

    return `DROP TRIGGER${ifExistsStr} ${triggerNameStr} ON ${tableNameStr}${cascadeStr};`;
  };

  return _drop;
}
