import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropConstraintOptions = DropOptions;

export type DropConstraint = (
  tableName: Name,
  constraintName: string,
  options?: DropConstraintOptions
) => string;

export function dropConstraint(mOptions: MigrationOptions): DropConstraint {
  const _drop: DropConstraint = (tableName, constraintName, options = {}) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);

    return `ALTER TABLE ${tableNameStr} DROP CONSTRAINT${ifExistsStr} ${constraintNameStr}${cascadeStr};`;
  };

  return _drop;
}
