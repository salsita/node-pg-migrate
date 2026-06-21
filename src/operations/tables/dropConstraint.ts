import type { MigrationOptions } from '../../migrationOptions';
import type { DropOptions, Name } from '../generalTypes';

export type DropConstraintOptions = DropOptions & {
  ifTableExists?: boolean;
};

export type DropConstraint = (
  tableName: Name,
  constraintName: string,
  options?: DropConstraintOptions
) => string;

export function dropConstraint(mOptions: MigrationOptions): DropConstraint {
  const _drop: DropConstraint = (tableName, constraintName, options = {}) => {
    const {
      ifExists = false,
      ifTableExists = false,
      cascade = false,
    } = options;

    const alterTableStr = ifTableExists
      ? 'ALTER TABLE IF EXISTS'
      : 'ALTER TABLE';
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);

    return `${alterTableStr} ${tableNameStr} DROP CONSTRAINT${ifExistsStr} ${constraintNameStr}${cascadeStr};`;
  };

  return _drop;
}
