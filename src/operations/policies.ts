import type { MigrationOptions } from '../types';
import type { PolicyOptions } from './policiesTypes';
import {
  AlterPolicy,
  CreatePolicy,
  DropPolicy,
  RenamePolicy,
} from './policiesTypes';

export { CreatePolicy, DropPolicy, AlterPolicy, RenamePolicy };

const makeClauses = ({ role, using, check }: PolicyOptions) => {
  const roles = (Array.isArray(role) ? role : [role]).join(', ');
  const clauses: string[] = [];
  if (roles) {
    clauses.push(`TO ${roles}`);
  }

  if (using) {
    clauses.push(`USING (${using})`);
  }

  if (check) {
    clauses.push(`WITH CHECK (${check})`);
  }

  return clauses;
};

export function dropPolicy(mOptions: MigrationOptions) {
  const _drop: DropPolicy = (tableName, policyName, options = {}) => {
    const { ifExists } = options;
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `DROP POLICY${ifExistsStr} ${policyNameStr} ON ${tableNameStr};`;
  };

  return _drop;
}

export function createPolicy(mOptions: MigrationOptions) {
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

export function alterPolicy(mOptions: MigrationOptions) {
  const _alter: AlterPolicy = (tableName, policyName, options = {}) => {
    const clausesStr = makeClauses(options).join(' ');
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };

  return _alter;
}

export function renamePolicy(mOptions: MigrationOptions) {
  const _rename: RenamePolicy = (tableName, policyName, newPolicyName) => {
    const policyNameStr = mOptions.literal(policyName);
    const newPolicyNameStr = mOptions.literal(newPolicyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} RENAME TO ${newPolicyNameStr};`;
  };

  _rename.reverse = (tableName, policyName, newPolicyName) =>
    _rename(tableName, newPolicyName, policyName);
  return _rename;
}
