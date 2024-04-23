import type { MigrationOptions } from '../../types';
import type { OnlyGrantOnSchemasOptions } from './grantOnSchemas';
import type { RevokeOnObjectsOptions } from './shared';
import { asArray, asRolesStr } from './shared';

export type RevokeOnSchemasOptions = OnlyGrantOnSchemasOptions &
  RevokeOnObjectsOptions;

export type RevokeOnSchemas = (
  options: RevokeOnSchemasOptions
) => string | string[];

export function revokeOnSchemas(mOptions: MigrationOptions): RevokeOnSchemas {
  const _revokeOnSchemas: RevokeOnSchemas = ({
    privileges,
    schemas,
    roles,
    onlyGrantOption,
    cascade,
  }) => {
    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = asArray(schemas).map(mOptions.literal).join(',');
    const privilegesStr = asArray(privileges).map(String).join(',');
    const onlyGrantOptionStr = onlyGrantOption ? ' GRANT OPTION FOR' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';

    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON SCHEMA ${schemasStr} FROM ${rolesStr}${cascadeStr};`;
  };

  return _revokeOnSchemas;
}
