import type { MigrationOptions } from '../../migrationOptions';
import type { Name } from '../generalTypes';
import type { PolicyOptions } from './shared';
import { makeClauses } from './shared';

export type AlterPolicy = (
  tableName: Name,
  policyName: string,
  policyOptions: PolicyOptions
) => string;

export function alterPolicy(mOptions: MigrationOptions): AlterPolicy {
  const _alter: AlterPolicy = (tableName, policyName, options = {}) => {
    const clauses = makeClauses(options);
    if (clauses.length === 0) {
      throw new Error('No policy options provided for alterPolicy');
    }

    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };

  return _alter;
}
