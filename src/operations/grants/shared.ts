import type { MigrationOptions } from '../../migrationOptions';
import { toArray } from '../../utils';
import type { CascadeOption, Name } from '../generalTypes';

export interface WithAdminOption {
  readonly withAdminOption?: boolean;
}

export interface OnlyAdminOption {
  readonly onlyAdminOption?: boolean;
}

export interface OnlyGrantOption {
  readonly onlyGrantOption?: boolean;
}

export interface WithGrantOption {
  readonly withGrantOption?: boolean;
}

export type TablePrivilege =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'TRUNCATE'
  | 'REFERENCES'
  | 'TRIGGER';

export type SchemaPrivilege = 'CREATE' | 'USAGE';

export interface CommonOnTablesOptions {
  privileges: TablePrivilege | TablePrivilege[] | 'ALL';
  roles: Name | Name[];
}

export type CommonGrantOnTablesOptions = CommonOnTablesOptions &
  WithGrantOption;

export interface SomeTablesOptions {
  tables: Name | Name[];
}

export interface AllTablesOptions {
  tables: 'ALL';
  schema: string;
}

export type RevokeOnObjectsOptions = OnlyGrantOption & CascadeOption;

export function isAllTablesOptions(
  options: AllTablesOptions | SomeTablesOptions
): options is AllTablesOptions {
  return 'schema' in options;
}

export function asRolesStr(
  roles: Name | Name[],
  mOptions: MigrationOptions
): string {
  return toArray(roles)
    .map((role) => (role === 'PUBLIC' ? role : mOptions.literal(role)))
    .join(', ');
}

export function asTablesStr(
  options: AllTablesOptions | SomeTablesOptions,
  mOptions: MigrationOptions
): string {
  return isAllTablesOptions(options)
    ? `ALL TABLES IN SCHEMA ${mOptions.literal(options.schema)}`
    : toArray(options.tables).map(mOptions.literal).join(', ');
}
