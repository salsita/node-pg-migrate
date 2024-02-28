import { IfExistsOption, Name } from './generalTypes';

export interface PolicyOptions {
  role?: string | string[];
  using?: string;
  check?: string;
}

interface CreatePolicyOptionsEn {
  command?: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

export type CreatePolicyOptions = CreatePolicyOptionsEn & PolicyOptions;

type CreatePolicyFn = (
  tableName: Name,
  policyName: string,
  options?: CreatePolicyOptions & IfExistsOption
) => string | string[];
export type CreatePolicy = CreatePolicyFn & { reverse: CreatePolicyFn };
export type DropPolicy = (
  tableName: Name,
  policyName: string,
  options?: IfExistsOption
) => string | string[];
export type AlterPolicy = (
  tableName: Name,
  policyName: string,
  options: PolicyOptions
) => string | string[];
type RenamePolicyFn = (
  tableName: Name,
  policyName: string,
  newPolicyName: string
) => string | string[];
export type RenamePolicy = RenamePolicyFn & { reverse: RenamePolicyFn };
