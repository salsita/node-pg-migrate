import type { MigrationOptions } from '../../migrationOptions';
import { formatParams } from '../../utils';
import type { Name, Reversible } from '../generalTypes';
import type { FunctionParam } from './shared';

export type RenameFunctionFn = (
  oldFunctionName: Name,
  functionParams: FunctionParam[],
  newFunctionName: Name
) => string;

export type RenameFunction = Reversible<RenameFunctionFn>;

export function renameFunction(mOptions: MigrationOptions): RenameFunction {
  const _rename: RenameFunction = (
    oldFunctionName,
    functionParams = [],
    newFunctionName
  ) => {
    const paramsStr = formatParams(functionParams, mOptions);
    const oldFunctionNameStr = mOptions.literal(oldFunctionName);
    const newFunctionNameStr = mOptions.literal(newFunctionName);

    return `ALTER FUNCTION ${oldFunctionNameStr}${paramsStr} RENAME TO ${newFunctionNameStr};`;
  };

  _rename.reverse = (oldFunctionName, functionParams, newFunctionName) =>
    _rename(newFunctionName, functionParams, oldFunctionName);

  return _rename;
}
