import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameOperatorFamilyFn = (
  oldOperatorFamilyName: Name,
  indexMethod: Name,
  newOperatorFamilyName: Name
) => string;

export type RenameOperatorFamily = Reversible<RenameOperatorFamilyFn>;

export function renameOperatorFamily(
  mOptions: MigrationOptions
): RenameOperatorFamily {
  const _rename: RenameOperatorFamily = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) => {
    const oldOperatorFamilyNameStr = mOptions.literal(oldOperatorFamilyName);
    const newOperatorFamilyNameStr = mOptions.literal(newOperatorFamilyName);

    return `ALTER OPERATOR FAMILY ${oldOperatorFamilyNameStr} USING ${indexMethod} RENAME TO ${newOperatorFamilyNameStr};`;
  };

  _rename.reverse = (
    oldOperatorFamilyName,
    indexMethod,
    newOperatorFamilyName
  ) => _rename(newOperatorFamilyName, indexMethod, oldOperatorFamilyName);

  return _rename;
}
