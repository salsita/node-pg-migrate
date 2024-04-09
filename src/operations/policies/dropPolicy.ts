import type { MigrationOptions } from '../../types';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropPolicy = (
  tableName: Name,
  policyName: string,
  options?: IfExistsOption
) => string | string[];

export function dropPolicy(mOptions: MigrationOptions): DropPolicy {
  const _drop: DropPolicy = (tableName, policyName, options = {}) => {
    const { ifExists } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `DROP POLICY${ifExistsStr} ${policyNameStr} ON ${tableNameStr};`;
  };

  return _drop;
}
