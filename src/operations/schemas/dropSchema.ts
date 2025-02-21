import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions } from '../generalTypes';

export type DropSchemaOptions = DropOptions;

export type DropSchema = (
  schemaName: string,
  dropOptions?: DropSchemaOptions
) => string;

export function dropSchema(mOptions: MigrationOptions): DropSchema {
  const _drop: DropSchema = (schemaName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const schemaNameStr = mOptions.literal(schemaName);

    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };

  return _drop;
}
