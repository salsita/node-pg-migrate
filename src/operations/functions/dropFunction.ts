import type { MigrationOptions } from '../../types';
import { formatParams } from '../../utils';
import type { DropOptions, Name } from '../generalTypes';
import type { FunctionParam } from './shared';

export type DropFunction = (
  functionName: Name,
  functionParams: FunctionParam[],
  dropOptions?: DropOptions
) => string | string[];

export function dropFunction(mOptions: MigrationOptions): DropFunction {
  const _drop: DropFunction = (
    functionName,
    functionParams = [],
    options = {}
  ) => {
    const { ifExists, cascade } = options;

    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);

    return `DROP FUNCTION${ifExistsStr} ${functionNameStr}${paramsStr}${cascadeStr};`;
  };

  return _drop;
}
