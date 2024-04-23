import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';
import type { PolicyOptions } from './shared';
import { makeClauses } from './shared';

export type AlterPolicy = (
  tableName: Name,
  policyName: string,
  options: PolicyOptions
) => string | string[];

export function alterPolicy(mOptions: MigrationOptions): AlterPolicy {
  const _alter: AlterPolicy = (tableName, policyName, options = {}) => {
    const clausesStr = makeClauses(options).join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };

  return _alter;
}
