import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { RevokeOnSchemasOptions } from './revokeOnSchemas';
import { revokeOnSchemas } from './revokeOnSchemas';
import type {
  RevokeOnObjectsOptions,
  SchemaPrivilege,
  WithGrantOption,
} from './shared';
import { asRolesStr } from './shared';

export interface OnlyGrantOnSchemasOptions {
  privileges: SchemaPrivilege | SchemaPrivilege[] | 'ALL';
  schemas: string[] | string;
  roles: Name | Name[];
}

export type GrantOnSchemasOptions = OnlyGrantOnSchemasOptions &
  WithGrantOption &
  RevokeOnObjectsOptions;

export type GrantOnSchemasFn = (
  grantOptions: GrantOnSchemasOptions & RevokeOnSchemasOptions
) => string;

export type GrantOnSchemas = Reversible<GrantOnSchemasFn>;

export function grantOnSchemas(mOptions: MigrationOptions): GrantOnSchemas {
  const _grantOnSchemas: GrantOnSchemas = (options) => {
    const { privileges, schemas, roles, withGrantOption = false } = options;

    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = toArray(schemas).map(mOptions.literal).join(', ');
    const privilegesStr = toArray(privileges).map(String).join(', ');
    const withGrantOptionStr = withGrantOption ? ' WITH GRANT OPTION' : '';

    return `GRANT ${privilegesStr} ON SCHEMA ${schemasStr} TO ${rolesStr}${withGrantOptionStr};`;
  };

  _grantOnSchemas.reverse = revokeOnSchemas(mOptions);

  return _grantOnSchemas;
}
