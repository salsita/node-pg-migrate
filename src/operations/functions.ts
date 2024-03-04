import type { MigrationOptions } from '../types';
import { escapeValue, formatParams } from '../utils';
import type {
  CreateFunction,
  DropFunction,
  RenameFunction,
} from './functionsTypes';

export type { CreateFunction, DropFunction, RenameFunction };

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
