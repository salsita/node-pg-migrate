import type { MigrationOptions } from '../../types';
import type { IfExistsOption, Name } from '../generalTypes';
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
  options?: CreatePolicyOptions & IfExistsOption
) => string | string[];

export type CreatePolicy = CreatePolicyFn & { reverse: CreatePolicyFn };

export function createPolicy(mOptions: MigrationOptions): CreatePolicy {
  const _create: CreatePolicy = (tableName, policyName, options = {}) => {
    const createOptions = {
      ...options,
      role: options.role || 'PUBLIC',
    };
    const clauses = [
      `FOR ${options.command || 'ALL'}`,
      ...makeClauses(createOptions),
    ];
    const clausesStr = clauses.join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `CREATE POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };

  _create.reverse = dropPolicy(mOptions);

  return _create;
}
