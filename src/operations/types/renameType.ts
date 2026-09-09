import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameTypeFn = (typeName: Name, newTypeName: Name) => string;

export type RenameType = Reversible<RenameTypeFn>;

export function renameType(mOptions: MigrationOptions): RenameType {
  return createRenameOperation(mOptions, {
    operation: 'renameType',
    keyword: 'TYPE',
    label: 'a type',
  });
}
