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
  const rename = (indexMethod: string) =>
    createRenameOperation(mOptions, {
      operation: 'renameOperatorClass',
      keyword: 'OPERATOR CLASS',
      label: 'an operator class',
      sourceSuffix: ` USING ${indexMethod}`,
    });

  const _rename: RenameOperatorClass = (
    oldOperatorClassName,
    indexMethod,
    newOperatorClassName
  ) => rename(indexMethod)(oldOperatorClassName, newOperatorClassName);

  _rename.reverse = (oldOperatorClassName, indexMethod, newOperatorClassName) =>
    rename(indexMethod).reverse(oldOperatorClassName, newOperatorClassName);

  return _rename;
}
