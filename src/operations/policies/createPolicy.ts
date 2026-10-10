import type { MigrationOptions } from '../../migrationOptions';
import { makeComment } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { DropPolicyOptions } from './dropPolicy';
import { dropPolicy } from './dropPolicy';
import type { PolicyOptions } from './shared';
import { makeClauses } from './shared';

export interface CreatePolicyOptionsEn {
  as?: 'PERMISSIVE' | 'RESTRICTIVE';

  command?: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

export type CreatePolicyOptions = CreatePolicyOptionsEn & PolicyOptions;

type CreatePolicyFn = (
  tableName: Name,
  policyName: string,
  policyOptions?: CreatePolicyOptions & DropPolicyOptions
) => string;

export type CreatePolicy = Reversible<CreatePolicyFn>;

export function createPolicy(mOptions: MigrationOptions): CreatePolicy {
  const _create: CreatePolicy = (tableName, policyName, options = {}) => {
    const { as, role = 'PUBLIC', command = 'ALL', comment } = options;

    const createOptions = {
      ...options,
      role,
    };

    const clauses = [`FOR ${command}`, ...makeClauses(createOptions)];
    if (as) {
      clauses.unshift(`AS ${as}`);
    }

    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    const queries = [
      `CREATE POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`,
    ];
    if (comment !== undefined) {
      queries.push(
        makeComment('POLICY', `${policyNameStr} ON ${tableNameStr}`, comment)
      );
    }

    return queries.join('\n');
  };

  _create.reverse = dropPolicy(mOptions);

  return _create;
}
