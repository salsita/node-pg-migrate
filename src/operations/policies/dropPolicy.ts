import type { MigrationOptions } from '../../migrationOptions';
import type { IfExistsOption, Name } from '../generalTypes';

export type DropPolicyOptions = IfExistsOption;

export type DropPolicy = (
  tableName: Name,
  policyName: string,
  dropOptions?: DropPolicyOptions
) => string;

export function dropPolicy(mOptions: MigrationOptions): DropPolicy {
  const _drop: DropPolicy = (tableName, policyName, options = {}) => {
    const { ifExists = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);

    return `DROP POLICY${ifExistsStr} ${policyNameStr} ON ${tableNameStr};`;
  };

  return _drop;
}
