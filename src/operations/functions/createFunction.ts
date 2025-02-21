import type { MigrationOptions } from '../../migrationOptions';
import { escapeValue, formatParams } from '../../utils';
import type { DropOptions, Name, Reversible, Value } from '../generalTypes';
import type { DropFunctionOptions } from './dropFunction';
import { dropFunction } from './dropFunction';
import type { FunctionOptions, FunctionParam } from './shared';

export type CreateFunctionOptions = FunctionOptions & DropOptions;

export type CreateFunctionFn = (
  functionName: Name,
  functionParams: FunctionParam[],
  functionOptions: CreateFunctionOptions & DropFunctionOptions,
  definition: Value
) => string;

export type CreateFunction = Reversible<CreateFunctionFn>;

export function createFunction(mOptions: MigrationOptions): CreateFunction {
  const _create: CreateFunction = (
    functionName,
    functionParams = [],
    functionOptions,
    definition
  ) => {
    const {
      replace = false,
      returns = 'void',
      language,
      window = false,
      behavior = 'VOLATILE',
      security = 'INVOKER',
      onNull = false,
      parallel,
      set,
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

    if (security !== 'INVOKER') {
      options.push(`SECURITY ${security}`);
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

    if (set) {
      for (const { configurationParameter, value } of set) {
        if (value === 'FROM CURRENT') {
          options.push(
            `SET ${mOptions.literal(configurationParameter)} FROM CURRENT`
          );
        } else {
          options.push(
            `SET ${mOptions.literal(configurationParameter)} TO ${value}`
          );
        }
      }
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
