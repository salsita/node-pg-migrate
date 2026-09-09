import type { MigrationOptions } from '../../migrationOptions';
import { formatParams } from '../../utils';
import { createRenameOperation } from '../createRenameOperation';
import type { Name, Reversible } from '../generalTypes';
import type { FunctionParam } from './shared';

export type RenameFunctionFn = (
  oldFunctionName: Name,
  functionParams: FunctionParam[],
  newFunctionName: Name
) => string;

export type RenameFunction = Reversible<RenameFunctionFn>;

export function renameFunction(mOptions: MigrationOptions): RenameFunction {
  const rename = createRenameOperation(mOptions, {
    operation: 'renameFunction',
    keyword: 'FUNCTION',
    label: 'a function',
  });

  const _rename: RenameFunction = (
    oldFunctionName,
    functionParams = [],
    newFunctionName
  ) =>
    rename(
      oldFunctionName,
      newFunctionName,
      formatParams(functionParams, mOptions)
    );

  _rename.reverse = (oldFunctionName, functionParams = [], newFunctionName) =>
    rename.reverse(
      oldFunctionName,
      newFunctionName,
      formatParams(functionParams, mOptions)
    );

  return _rename;
}
