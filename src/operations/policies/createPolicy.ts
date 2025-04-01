import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';
import type { DropPolicyOptions } from './dropPolicy';
import { dropPolicy } from './dropPolicy';
import type { PolicyOptions } from './shared';
import { makeClauses } from './shared';

export interface CreatePolicyOptionsEn {
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
    const { role = 'PUBLIC', command = 'ALL' } = options;

    const createOptions = {
      ...options,
      role,
    };

    const clauses = [`FOR ${command}`, ...makeClauses(createOptions)];
    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `CREATE POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };

  _create.reverse = dropPolicy(mOptions);

  return _create;
}
