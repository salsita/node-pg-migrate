import { template, escapeValue, formatParams } from '../utils';

export const drop = type_shorthands =>
  (function_name, function_params = [], { ifExists, cascade } = {}) =>
    template`DROP FUNCTION${ifExists ? ' IF EXISTS' : ''} "${function_name}"${formatParams(function_params, type_shorthands)}${cascade ? ' CASCADE' : ''};`;

export const create = (type_shorthands) => {
  const _create = (function_name, function_params = [], function_options = {}, definition) => {
    const {
      replace,
      returns = 'void',
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
  AS ${escapeValue(definition)}
  ${options.join('\n  ')};`;
  };

  _create.reverse = drop(type_shorthands);

  return _create;
};

export const rename = (type_shorthands) => {
  const _rename = (old_function_name, function_params = [], new_function_name) =>
    template`ALTER FUNCTION "${old_function_name}"${formatParams(function_params, type_shorthands)} RENAME TO "${new_function_name}";`;

  _rename.reverse = (old_function_name, function_params, new_function_name) =>
    _rename(new_function_name, function_params, old_function_name);

  return _rename;
};
