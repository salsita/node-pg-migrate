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
  const rename = (functionParams: FunctionParam[]) =>
    createRenameOperation(mOptions, {
      operation: 'renameFunction',
      keyword: 'FUNCTION',
      label: 'a function',
      sourceSuffix: formatParams(functionParams, mOptions),
    });

  const _rename: RenameFunction = (
    oldFunctionName,
    functionParams = [],
    newFunctionName
  ) => rename(functionParams)(oldFunctionName, newFunctionName);

  _rename.reverse = (oldFunctionName, functionParams = [], newFunctionName) =>
    rename(functionParams).reverse(oldFunctionName, newFunctionName);

  return _rename;
}
