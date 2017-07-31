import { schemalize, template, escapeValue, applyType } from '../utils';

const formatParam = type_shorthands => (param) => {
  const { mode, name, type, default: defaultValue } = applyType(param, type_shorthands);
  const options = [];
  if (mode) {
    options.push(mode);
  }
  if (name) {
    options.push(schemalize(name));
  }
  if (type) {
    options.push(type);
  }
  if (defaultValue) {
    options.push(`DEFAULT ${escapeValue(defaultValue)}`);
  }
  return options.join(' ');
};

const formatParams = (params = [], type_shorthands) => `(${params.map(formatParam(type_shorthands)).join(', ')})`;

export const drop = (function_name, function_params = [], { ifExists, cascade } = {}) =>
  template`DROP FUNCTION${ifExists ? ' IF EXISTS' : ''} "${function_name}"${formatParams(function_params)}${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (function_name, function_params = [], function_options = {}, definition) => {
    const {
      replace,
      returns = 'void',
      delimiter = '$$',
      language,
      window,
      behavior = 'VOLATILE',
      onNull,
      parallel = 'UNSAFE',
    } = function_options;
    const options = [];
    if (behavior) {
      options.push(behavior);
    }
    if (language) {
      options.push(`LANGUAGE ${language}`);
    } else {
      throw new Error(`Language for function ${function_name} have to be specified`);
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

    return template`CREATE${replace ? ' OR REPLACE' : ''} FUNCTION "${function_name}"${formatParams(function_params, type_shorthands)}
  RETURNS ${returns}
  AS ${delimiter}
${definition}
${delimiter}
  ${options.join('\n  ')};`;
  };
  _create.reverse = drop;
  return _create;
};

export const rename = (old_function_name, function_params = [], new_function_name) =>
  template`ALTER FUNCTION "${old_function_name}"${formatParams(function_params)} RENAME TO "${new_function_name}";`;

export const undoRename = (old_function_name, function_params = [], new_function_name) =>
  rename(new_function_name, function_params, old_function_name);

rename.reverse = undoRename;
