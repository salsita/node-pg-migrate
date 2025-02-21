import type { MigrationOptions } from '../../migrationOptions';
import { formatParams } from '../../utils';
import type { DropOptions, Name } from '../generalTypes';
import type { FunctionParam } from './shared';

export type DropFunctionOptions = DropOptions;

export type DropFunction = (
  functionName: Name,
  functionParams: FunctionParam[],
  dropOptions?: DropFunctionOptions
) => string;

export function dropFunction(mOptions: MigrationOptions): DropFunction {
  const _drop: DropFunction = (
    functionName,
    functionParams = [],
    options = {}
  ) => {
    const { ifExists = false, cascade = false } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);

    return `DROP FUNCTION${ifExistsStr} ${functionNameStr}${paramsStr}${cascadeStr};`;
  };

  return _drop;
}
