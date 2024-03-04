import type { DropOptions, Name, Value } from './generalTypes';

export interface FunctionParamType {
  mode?: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC';

  name?: string;

  type: string;

  default?: Value;
}

export type FunctionParam = string | FunctionParamType;

export interface FunctionOptions {
  returns?: string;

  language: string;

  replace?: boolean;

  window?: boolean;

  behavior?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';

  onNull?: boolean;

  parallel?: 'UNSAFE' | 'RESTRICTED' | 'SAFE';
}

type CreateFunctionFn = (
  functionName: Name,
  functionParams: FunctionParam[],
  functionOptions: FunctionOptions & DropOptions,
  definition: Value
) => string | string[];

export type CreateFunction = CreateFunctionFn & { reverse: CreateFunctionFn };

export type DropFunction = (
  functionName: Name,
  functionParams: FunctionParam[],
  dropOptions?: DropOptions
) => string | string[];

type RenameFunctionFn = (
  oldFunctionName: Name,
  functionParams: FunctionParam[],
  newFunctionName: Name
) => string | string[];

export type RenameFunction = RenameFunctionFn & { reverse: RenameFunctionFn };
