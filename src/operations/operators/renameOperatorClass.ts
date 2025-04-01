import type { MigrationOptions } from '../../migrationOptions';
import type { Name, Reversible } from '../generalTypes';

export type RenameOperatorClassFn = (
  oldOperatorClassName: Name,
  indexMethod: Name,
  newOperatorClassName: Name
) => string;

export type RenameOperatorClass = Reversible<RenameOperatorClassFn>;

export function renameOperatorClass(
  mOptions: MigrationOptions
): RenameOperatorClass {
  const _rename: RenameOperatorClass = (
    oldOperatorClassName,
    indexMethod,
    newOperatorClassName
  ) => {
    const oldOperatorClassNameStr = mOptions.literal(oldOperatorClassName);
    const newOperatorClassNameStr = mOptions.literal(newOperatorClassName);

    return `ALTER OPERATOR CLASS ${oldOperatorClassNameStr} USING ${indexMethod} RENAME TO ${newOperatorClassNameStr};`;
  };

  _rename.reverse = (oldOperatorClassName, indexMethod, newOperatorClassName) =>
    _rename(newOperatorClassName, indexMethod, oldOperatorClassName);

  return _rename;
}
