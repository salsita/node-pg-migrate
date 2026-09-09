import type { MigrationOptions } from '../../migrationOptions';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';

export type RenameOperatorClassFn = (
  oldOperatorClassName: Name,
  indexMethod: string,
  newOperatorClassName: Name
) => string;

export type RenameOperatorClass = Reversible<RenameOperatorClassFn>;

export function renameOperatorClass(
  mOptions: MigrationOptions
): RenameOperatorClass {
  const rename = createRenameOperation(mOptions, {
    operation: 'renameOperatorClass',
    keyword: 'OPERATOR CLASS',
    label: 'an operator class',
  });

  const _rename: RenameOperatorClass = (
    oldOperatorClassName,
    indexMethod,
    newOperatorClassName
  ) =>
    rename(oldOperatorClassName, newOperatorClassName, ` USING ${indexMethod}`);

  _rename.reverse = (oldOperatorClassName, indexMethod, newOperatorClassName) =>
    rename.reverse(
      oldOperatorClassName,
      newOperatorClassName,
      ` USING ${indexMethod}`
    );

  return _rename;
}
