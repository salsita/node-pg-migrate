import type { MigrationOptions } from '../../types';
import type { DropOptions } from '../generalTypes';

export type DropSchema = (
  schemaName: string,
  dropOptions?: DropOptions
) => string | string[];

export function dropSchema(mOptions: MigrationOptions): DropSchema {
  const _drop: DropSchema = (schemaName, options = {}) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const schemaNameStr = mOptions.literal(schemaName);

    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };

  return _drop;
}
