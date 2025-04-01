import type { MigrationOptions } from '../../migrationOptions';
import type { IfNotExistsOption, Reversible } from '../generalTypes';
import type { DropSchemaOptions } from './dropSchema';
import { dropSchema } from './dropSchema';

export interface CreateSchemaOptions extends IfNotExistsOption {
  authorization?: string;
}

export type CreateSchemaFn = (
  schemaName: string,
  schemaOptions?: CreateSchemaOptions & DropSchemaOptions
) => string;

export type CreateSchema = Reversible<CreateSchemaFn>;

export function createSchema(mOptions: MigrationOptions): CreateSchema {
  const _create: CreateSchema = (schemaName: string, options = {}) => {
    const { ifNotExists = false, authorization } = options;

    const ifNotExistsStr = ifNotExists ? ' IF NOT EXISTS' : '';
    const schemaNameStr = mOptions.literal(schemaName);
    const authorizationStr = authorization
      ? ` AUTHORIZATION ${authorization}`
      : '';

    return `CREATE SCHEMA${ifNotExistsStr} ${schemaNameStr}${authorizationStr};`;
  };

  _create.reverse = dropSchema(mOptions);

  return _create;
}
