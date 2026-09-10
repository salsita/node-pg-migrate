import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';
import { formatIndexMethod } from './formatIndexMethod';

export type RenameOperatorFamilyFn = (
  oldOperatorFamilyName: Name,
  indexMethod: string,
  newOperatorFamilyName: Name
) => string;

export type RenameOperatorFamily = Reversible<RenameOperatorFamilyFn>;

export function renameOperatorFamily(
  mOptions: MigrationOptions
): RenameOperatorFamily {
  const rename = (indexMethod: string) =>
    createRenameOperation(mOptions, {
      operation: 'renameOperatorFamily',
      keyword: 'OPERATOR FAMILY',
      label: 'an operator family',
      sourceSuffix: formatIndexMethod(indexMethod, 'renameOperatorFamily'),
    });

  const _rename: RenameOperatorFamily = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) => rename(indexMethod)(oldOperatorFamilyName, newOperatorFamilyName);

  _rename.reverse = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) =>
    rename(indexMethod).reverse(oldOperatorFamilyName, newOperatorFamilyName);

  return _rename;
}
