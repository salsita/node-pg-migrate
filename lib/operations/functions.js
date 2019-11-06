const { escapeValue, formatParams } = require('../utils');

function dropFunction(mOptions) {
  const _drop = (
    functionName,
    functionParams = [],
    { ifExists, cascade } = {}
  ) => {
    const ifExistsStr = ifExists ? ' IF EXISTS' : '';
    const cascadeStr = cascade ? ' CASCADE' : '';
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);
    return `DROP FUNCTION${ifExistsStr} ${functionNameStr}${paramsStr}${cascadeStr};`;
  };
  return _drop;
}

function createFunction(mOptions) {
  const _create = (
    functionName,
    functionParams = [],
    functionOptions = {},
    definition
  ) => {
    const {
      replace,
      returns = 'void',
      language,
      window,
      behavior = 'VOLATILE',
      onNull,
      strict,
      security,
      parallel,
      cost,
      rows,
      support
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
    if (onNull === true || onNull === 'NULL' || strict) {
      options.push('RETURNS NULL ON NULL INPUT');
    }
    if (security) {
      options.push(`SECURITY ${security}`);
    }
    if (parallel) {
      options.push(`PARALLEL ${parallel}`);
    }
    if (typeof cost !== 'undefined') {
      options.push(`COST ${cost}`);
    }
    if (typeof rows !== 'undefined') {
      options.push(`ROWS ${rows}`);
    }
    if (support) {
      options.push(`SUPPORT ${support}`);
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

function renameFunction(mOptions) {
  const _rename = (oldName, functionParams = [], newName) => {
    const paramsStr = formatParams(functionParams, mOptions);
    let oldFn = typeof oldName === 'string' ? { name: oldName } : oldName;
    const newFn = typeof newName === 'string' ? { name: newName } : newName;

    const stmts = [];
    if (newFn.schema && newFn.schema !== oldFn.schema) {
      const oldFunctionNameStr = mOptions.literal(oldFn);
      const newFunctionSchemaStr = mOptions.literal(newFn.schema);
      stmts.push(
        `ALTER FUNCTION ${oldFunctionNameStr}${paramsStr} SET SCHEMA ${newFunctionSchemaStr};`
      );
      oldFn = { ...oldFn, schema: newFn.schema };
    }
    if (newFn.name !== oldFn.name) {
      const oldFunctionNameStr = mOptions.literal(oldFn);
      const newFunctionNameStr = mOptions.literal(newFn.name);
      stmts.push(
        `ALTER FUNCTION ${oldFunctionNameStr}${paramsStr} RENAME TO ${newFunctionNameStr};`
      );
    }
    return stmts.join('\n');
  };
  _rename.reverse = (oldFunctionName, functionParams, newFunctionName) =>
    _rename(newFunctionName, functionParams, oldFunctionName);
  return _rename;
}

module.exports = {
  createFunction,
  dropFunction,
  renameFunction
};
