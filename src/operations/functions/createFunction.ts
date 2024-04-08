import type { MigrationOptions } from '../../types';
import { escapeValue, formatParams } from '../../utils';
import type { DropOptions, Name, Value } from '../generalTypes';
import { dropFunction } from './dropFunction';
import type { FunctionOptions, FunctionParam } from './shared';

export type CreateFunctionFn = (
  functionName: Name,
  functionParams: FunctionParam[],
  functionOptions: FunctionOptions & DropOptions,
  definition: Value
) => string | string[];

export type CreateFunction = CreateFunctionFn & { reverse: CreateFunctionFn };

export function createFunction(mOptions: MigrationOptions): CreateFunction {
  const _create: CreateFunction = (
    functionName,
    functionParams = [],
    functionOptions,
    definition
  ) => {
    const {
      replace,
      returns = 'void',
      language,
      window,
      behavior = 'VOLATILE',
      onNull,
      parallel,
    } = functionOptions;

    const options: string[] = [];

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
