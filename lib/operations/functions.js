import { template, escapeValue, formatParams } from '../utils';

export const drop = typeShorthands =>
  (functionName, functionParams = [], { ifExists, cascade } = {}) =>
    template`DROP FUNCTION${ifExists ? ' IF EXISTS' : ''} "${functionName}"${formatParams(functionParams, typeShorthands)}${cascade ? ' CASCADE' : ''};`;

export const create = (typeShorthands) => {
  const _create = (functionName, functionParams = [], functionOptions = {}, definition) => {
    const {
      replace,
      returns = 'void',
      language,
      window,
      behavior = 'VOLATILE',
      onNull,
      parallel = 'UNSAFE',
    } = functionOptions;
    const options = [];
    if (behavior) {
      options.push(behavior);
    }
    if (language) {
      options.push(`LANGUAGE ${language}`);
    } else {
      throw new Error(`Language for function ${functionName} have to be specified`);
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

    return template`CREATE${replace ? ' OR REPLACE' : ''} FUNCTION "${functionName}"${formatParams(functionParams, typeShorthands)}
  RETURNS ${returns}
  AS ${escapeValue(definition)}
  ${options.join('\n  ')};`;
  };

  _create.reverse = drop(typeShorthands);

  return _create;
};

export const rename = (typeShorthands) => {
  const _rename = (oldFunctionName, functionParams = [], newFunctionName) =>
    template`ALTER FUNCTION "${oldFunctionName}"${formatParams(functionParams, typeShorthands)} RENAME TO "${newFunctionName}";`;

  _rename.reverse = (oldFunctionName, functionParams, newFunctionName) =>
    _rename(newFunctionName, functionParams, oldFunctionName);

  return _rename;
};
