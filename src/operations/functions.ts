import { DropOptions, Name, Value } from '../definitions';
import { MigrationOptions } from '../migration-builder';
import { escapeValue, formatParams } from '../utils';

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

export function dropFunction(mOptions: MigrationOptions) {
  const _drop = (
    functionName: Name,
    functionParams: FunctionParam[] = [],
    { ifExists, cascade }: DropOptions = {}
  ) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);
    return `DROP FUNCTION${ifExistsStr} ${functionNameStr}${paramsStr}${cascadeStr};`;
  };
  return _drop;
}

export function createFunction(mOptions: MigrationOptions) {
  const _create = (
    functionName: Name,
    functionParams: FunctionParam[] = [],
    functionOptions: FunctionOptions = {},
    definition: Value
  ) => {
    const {
      replace,
      returns = 'void',
      language,
      window,
      behavior = 'VOLATILE',
      onNull,
      parallel
    } = functionOptions;
    const options = [];
    if (behavior) {
      options.push(behavior);
    }
    if (language) {
      options.push(`LANGUAGE ${language}`);
    } else {
      throw new Error(
        `Language for function ${functionName} have to be specified`
      );
    }
    if (window) {
      options.push('WINDOW');
    }
    if (onNull) {
      options.push('RETURNS NULL ON NULL INPUT');
    }
    if (parallel) {
      options.push(`PARALLEL ${parallel}`);
    }

    const replaceStr = replace ? ' OR REPLACE' : '';
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);

    return `CREATE${replaceStr} FUNCTION ${functionNameStr}${paramsStr}
  RETURNS ${returns}
  AS ${escapeValue(definition)}
  ${options.join('\n  ')};`;
  };
  _create.reverse = dropFunction(mOptions);
  return _create;
}

export function renameFunction(mOptions: MigrationOptions) {
  const _rename = (
    oldFunctionName: Name,
    functionParams: FunctionParam[] = [],
    newFunctionName: Name
  ) => {
    const paramsStr = formatParams(functionParams, mOptions);
    const oldFunctionNameStr = mOptions.literal(oldFunctionName);
    const newFunctionNameStr = mOptions.literal(newFunctionName);
    return `ALTER FUNCTION ${oldFunctionNameStr}${paramsStr} RENAME TO ${newFunctionNameStr};`;
  };
  _rename.reverse = (
    oldFunctionName: Name,
    functionParams: FunctionParam[],
    newFunctionName: Name
  ) => _rename(newFunctionName, functionParams, oldFunctionName);
  return _rename;
}
