import type { LiteralUnion, Name, Value } from '../generalTypes';

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

  onNull?: boolean | 'CALLED' | 'RETURNS NULL';

  parallel?: 'UNSAFE' | 'RESTRICTED' | 'SAFE';

  cost?: number;

  rows?: number;

  support?: Name;

  set?: Array<{
    configurationParameter: string;
    value: LiteralUnion<'FROM CURRENT'>;
  }>;
}
