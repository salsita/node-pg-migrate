// This is used to create unescaped strings
// exposed in the migrations via pgm.func
export class PgLiteral {
  static create(str) {
    return new PgLiteral(str);
  }

  constructor(str) {
    this._str = str;
  }

  toString() {
    return this._str;
  }
}

export const schemalize = (v) => {
  if (typeof v === 'object') {
    const { schema, name } = v;
    return (schema ? `${schema}"."` : '') + name;
  }
  return v;
};

export const opSchemalize = (v) => {
  if (typeof v === 'object') {
    const { schema, name } = v;
    return schema ? `OPERATOR(${schema}.${name})` : name;
  }
  return v;
};

export const t = (s, d) =>
  Object
    .keys(d || {})
    .reduce((str, p) => str.replace(new RegExp(`{${p}}`, 'g'), schemalize(d[p])), s);

export const escapeValue = (val) => {
  if (val === null) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val.toString();
  }
  if (typeof val === 'string') {
    let dollars;
    let index = 0;
    do {
      index += 1;
      dollars = `$pg${index}$`;
    } while (val.indexOf(dollars) >= 0);
    return `${dollars}${val}${dollars}`;
  }
  if (typeof val === 'number') {
    return val;
  }
  if (Array.isArray(val)) {
    return `ARRAY[${val.map(escapeValue).join(',').replace(/ARRAY/g, '')}]`;
  }
  if (val instanceof PgLiteral) {
    return val.toString();
  }
  return '';
};

export const template = (strings, ...keys) => {
  const result = [strings[0]];
  keys.forEach((key, i) => {
    result.push(schemalize(key), strings[i + 1]);
  });
  return result.join('');
};

export const opTemplate = (strings, ...keys) => {
  const result = [strings[0]];
  keys.forEach((key, i) => {
    result.push(opSchemalize(key), strings[i + 1]);
  });
  return result.join('');
};

export const getMigrationTableSchema = options => options.migrationsSchema || options.schema || 'public';

export const finallyPromise = func => [
  func,
  (err) => {
    const errHandler = (innerErr) => {
      console.error(
        innerErr.stack
          ? innerErr.stack
          : innerErr
      );
      throw err;
    };
    try {
      return Promise
        .resolve(func())
        .then(
          () => {
            throw err;
          },
          errHandler
        );
    } catch (innerErr) {
      return errHandler(innerErr);
    }
  },
];

export const quote = array => array.map(item => template`"${item}"`);

const typeAdapters = {
  int: 'integer',
  string: 'text',
  float: 'real',
  double: 'double precision',
  datetime: 'timestamp',
  bool: 'boolean',
};

const defaultTypeShorthands = {
  id: { type: 'serial', primaryKey: true }, // convenience type for serial primary keys
};

// some convenience adapters -- see above
export const applyTypeAdapters = type => (typeAdapters[type] ? typeAdapters[type] : type);

export const applyType = (type, extendingTypeShorthands = {}) => {
  const typeShorthands = { ...defaultTypeShorthands, ...extendingTypeShorthands };
  let options = type;
  if (typeof type === 'string') {
    options = typeShorthands[type] // eslint-disable-line no-param-reassign
      ? typeShorthands[type]
      : { type };
  }

  options.type = applyTypeAdapters(options.type); // eslint-disable-line no-param-reassign

  return options;
};

const formatParam = typeShorthands => (param) => {
  const {
    mode,
    name,
    type,
    default: defaultValue,
  } = applyType(param, typeShorthands);
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

export const formatParams = (params = [], typeShorthands) => `(${params.map(formatParam(typeShorthands)).join(', ')})`;

export const comment = (object, name, text) => template`COMMENT ON ${object} "${name}" IS ${text ? `'${text}'` : 'NULL'};`;
