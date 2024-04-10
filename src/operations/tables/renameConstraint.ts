import type { MigrationOptions } from '../../types';
import type { Name } from '../generalTypes';

export type RenameConstraintFn = (
  tableName: Name,
  oldConstraintName: string,
  newConstraintName: string
) => string | string[];

export type RenameConstraint = RenameConstraintFn & {
  reverse: RenameConstraintFn;
};

export function renameConstraint(mOptions: MigrationOptions): RenameConstraint {
  const _rename: RenameConstraint = (tableName, constraintName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);
    const newNameStr = mOptions.literal(newName);

    return `ALTER TABLE ${tableNameStr} RENAME CONSTRAINT ${constraintNameStr} TO ${newNameStr};`;
  };

  _rename.reverse = (tableName, constraintName, newName) =>
    _rename(tableName, newName, constraintName);

  return _rename;
}
