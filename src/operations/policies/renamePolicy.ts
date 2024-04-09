import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenamePolicyFn = (
  tableName: Name,
  policyName: string,
  newPolicyName: string
) => string | string[];

export type RenamePolicy = RenamePolicyFn & { reverse: RenamePolicyFn };

export function renamePolicy(mOptions: MigrationOptions): RenamePolicy {
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
