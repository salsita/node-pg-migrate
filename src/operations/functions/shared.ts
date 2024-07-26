import type { Value } from '../generalTypes';

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

  security?: 'INVOKER' | 'DEFINER';

  onNull?: boolean;

  parallel?: 'UNSAFE' | 'RESTRICTED' | 'SAFE';

  set?: Array<{
    name: string;
    value: 'FROM CURRENT' | string;
  }>;
}
