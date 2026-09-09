import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameOperatorFamilyFn = (
  oldOperatorFamilyName: Name,
  indexMethod: string,
  newOperatorFamilyName: Name
) => string;

export type RenameOperatorFamily = Reversible<RenameOperatorFamilyFn>;

export function renameOperatorFamily(
  mOptions: MigrationOptions
): RenameOperatorFamily {
  const rename = createRenameOperation(mOptions, {
    operation: 'renameOperatorFamily',
    keyword: 'OPERATOR FAMILY',
    label: 'an operator family',
  });

  const _rename: RenameOperatorFamily = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) =>
    rename(
      oldOperatorFamilyName,
      newOperatorFamilyName,
      ` USING ${indexMethod}`
    );

  _rename.reverse = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) =>
    rename.reverse(
      oldOperatorFamilyName,
      newOperatorFamilyName,
      ` USING ${indexMethod}`
    );

  return _rename;
}
