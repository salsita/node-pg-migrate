import type { MigrationOptions } from '../../migrationOptions';
import { makeComment } from '../../utils';
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
    const { comment } = options;
    const clauses = makeClauses(options);
    if (clauses.length === 0 && comment === undefined) {
      throw new Error('No policy options provided for alterPolicy');
    }

    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    const queries: string[] = [];
    if (clauses.length > 0) {
      queries.push(
        `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`
      );
    }
    if (comment !== undefined) {
      queries.push(
        makeComment('POLICY', `${policyNameStr} ON ${tableNameStr}`, comment)
      );
    }

    return queries.join('\n');
  };

  return _alter;
}
