import type { MigrationOptions } from '../../types';
import { toArray } from '../../utils';
import type {
  AllTablesOptions,
  CommonOnTablesOptions,
  RevokeOnObjectsOptions,
  SomeTablesOptions,
} from './shared';
import { asRolesStr, asTablesStr } from './shared';

export type RevokeOnTablesOptions = CommonOnTablesOptions &
  (AllTablesOptions | SomeTablesOptions) &
  RevokeOnObjectsOptions;

export type RevokeOnTables = (options: RevokeOnTablesOptions) => string;

export function revokeOnTables(mOptions: MigrationOptions): RevokeOnTables {
  const _revokeOnTables: RevokeOnTables = (options) => {
    const { privileges, roles, onlyGrantOption, cascade } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const tablesStr = asTablesStr(options, mOptions);
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON ${tablesStr} FROM ${rolesStr}${cascadeStr};`;
  };

  return _revokeOnTables;
}
