import type { MigrationOptions } from '../../types';
import { toArray } from '../../utils';
import type { Reversible } from '../generalTypes';
import { revokeOnTables } from './revokeOnTables';
import type {
  AllTablesOptions,
  CommonGrantOnTablesOptions,
  RevokeOnObjectsOptions,
  SomeTablesOptions,
} from './shared';
import { asRolesStr, asTablesStr } from './shared';

export type GrantOnSomeTablesOptions = CommonGrantOnTablesOptions &
  SomeTablesOptions;

export type GrantOnAllTablesOptions = CommonGrantOnTablesOptions &
  AllTablesOptions;

export type GrantOnTablesOptions =
  | GrantOnSomeTablesOptions
  | GrantOnAllTablesOptions;

export type GrantOnTablesFn = (
  options: GrantOnTablesOptions & RevokeOnObjectsOptions
) => string | string[];

export type GrantOnTables = Reversible<GrantOnTablesFn>;

export function grantOnTables(mOptions: MigrationOptions): GrantOnTables {
  const _grantOnTables: GrantOnTables = (options) => {
    const { privileges, roles, withGrantOption } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const tablesStr = asTablesStr(options, mOptions);
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : '';

    return `GRANT ${privilegesStr} ON ${tablesStr} TO ${rolesStr}${withGrantOptionStr};`;
  };

  _grantOnTables.reverse = revokeOnTables(mOptions);

  return _grantOnTables;
}
