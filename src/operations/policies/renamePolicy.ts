import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenamePolicyFn = (
  tableName: Name,
  policyName: string,
  newPolicyName: string
) => string;

export type RenamePolicy = Reversible<RenamePolicyFn>;

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
