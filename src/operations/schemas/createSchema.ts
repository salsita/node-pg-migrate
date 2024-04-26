import type { MigrationOptions } from '../../types';
import type {
  DropOptions,
  IfNotExistsOption,
  Reversible,
} from '../generalTypes';
import { dropSchema } from './dropSchema';

export interface CreateSchemaOptions extends IfNotExistsOption {
  authorization?: string;
}

export type CreateSchemaFn = (
  schemaName: string,
  schemaOptions?: CreateSchemaOptions & DropOptions
) => string;

export type CreateSchema = Reversible<CreateSchemaFn>;

export function createSchema(mOptions: MigrationOptions): CreateSchema {
  const _create: CreateSchema = (schemaName: string, options = {}) => {
    const { ifNotExists, authorization } = options;

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
