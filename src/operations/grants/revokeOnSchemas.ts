import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { OnlyGrantOnSchemasOptions } from './grantOnSchemas';
import type { RevokeOnObjectsOptions } from './shared';
import { asRolesStr } from './shared';

export type RevokeOnSchemasOptions = OnlyGrantOnSchemasOptions &
  RevokeOnObjectsOptions;

export type RevokeOnSchemas = (revokeOptions: RevokeOnSchemasOptions) => string;

export function revokeOnSchemas(mOptions: MigrationOptions): RevokeOnSchemas {
  const _revokeOnSchemas: RevokeOnSchemas = (options) => {
    const {
      privileges,
      schemas,
      roles,
      onlyGrantOption = false,
      cascade = false,
    } = options;

    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = toArray(schemas).map(mOptions.literal).join(', ');
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON SCHEMA ${schemasStr} FROM ${rolesStr}${cascadeStr};`;
  };

  return _revokeOnSchemas;
}
