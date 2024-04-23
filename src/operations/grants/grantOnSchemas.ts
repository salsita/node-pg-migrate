import type { MigrationOptions } from '../../types';
import type { Name, Reversible } from '../generalTypes';
import { revokeOnSchemas } from './revokeOnSchemas';
import type {
  RevokeOnObjectsOptions,
  SchemaPrivilege,
  WithGrantOption,
} from './shared';
import { asArray, asRolesStr } from './shared';

export interface OnlyGrantOnSchemasOptions {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL';
  schemas: string[] | string;
  roles: Name | Name[];
}

export type GrantOnSchemasOptions = OnlyGrantOnSchemasOptions &
  WithGrantOption &
  RevokeOnObjectsOptions;

export type GrantOnSchemasFn = (
  options: GrantOnSchemasOptions
) => string | string[];

export type GrantOnSchemas = Reversible<GrantOnSchemasFn>;

export function grantOnSchemas(mOptions: MigrationOptions): GrantOnSchemas {
  const _grantOnSchemas: GrantOnSchemas = ({
    privileges,
    schemas,
    roles,
    withGrantOption,
  }) => {
    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = asArray(schemas).map(mOptions.literal).join(', ');
    const privilegesStr = asArray(privileges).map(String).join(', ');
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : '';

    return `GRANT ${privilegesStr} ON SCHEMA ${schemasStr} TO ${rolesStr}${withGrantOptionStr};`;
  };

  _grantOnSchemas.reverse = revokeOnSchemas(mOptions);

  return _grantOnSchemas;
}
