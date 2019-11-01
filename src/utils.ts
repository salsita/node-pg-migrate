import decamelize from 'decamelize';

// This is used to create unescaped strings
// exposed in the migrations via pgm.func
export class PgLiteral {
  static create(str: string): PgLiteral {
    return new PgLiteral(str);
  }

  private readonly _str: string;

  constructor(str: string) {
    this._str = str;
  }

  toString(): string {
    return this._str;
  }
}

const identity = v => v;
const quote = str => `"${str}"`;

export const createSchemalize = (
  shouldDecamelize: boolean,
  shouldQuote: boolean
) => {
  const transform: (v: any) => any = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity
  ].reduce((acc, fn) => (fn === identity ? acc : x => acc(fn(x))));
  return v => {
    if (typeof v === 'object') {
      const { schema, name } = v;
      return (schema ? `${transform(schema)}.` : '') + transform(name);
    }
    return transform(v);
  };
};

export const createTransformer = literal => (s, d) =>
  Object.keys(d || {}).reduce(
    (str, p) => str.replace(new RegExp(`{${p}}`, 'g'), literal(d[p])), // eslint-disable-line security/detect-non-literal-regexp
    s
  );

export const escapeValue = val => {
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
    const arrayStr = val
      .map(escapeValue)
      .join(',')
      .replace(/ARRAY/g, '');
    return `ARRAY[${arrayStr}]`;
  }
  if (val instanceof PgLiteral) {
    return val.toString();
  }
  return '';
};

export const getSchemas = schema => {
  const schemas = (Array.isArray(schema) ? schema : [schema]).filter(
    s => typeof s === 'string' && s.length > 0
  );
  return schemas.length > 0 ? schemas : ['public'];
};

export const getMigrationTableSchema = options =>
  options.migrationsSchema !== undefined
    ? options.migrationsSchema
    : getSchemas(options.schema)[0];

const typeAdapters = {
  int: 'integer',
  string: 'text',
  float: 'real',
  double: 'double precision',
  datetime: 'timestamp',
  bool: 'boolean'
};

const defaultTypeShorthands = {
  id: { type: 'serial', primaryKey: true } // convenience type for serial primary keys
};

// some convenience adapters -- see above
export const applyTypeAdapters = type =>
  typeAdapters[type] ? typeAdapters[type] : type;

export const applyType = (type, extendingTypeShorthands = {}) => {
  const typeShorthands = {
    ...defaultTypeShorthands,
    ...extendingTypeShorthands
  };
  const options = typeof type === 'string' ? { type } : type;
  let ext = null;
  const types = [options.type];
  while (typeShorthands[types[types.length - 1]]) {
    if (ext) {
      delete ext.type;
    }
    ext = { ...typeShorthands[types[types.length - 1]], ...ext };
    if (types.includes(ext.type)) {
      throw new Error(
        `Shorthands contain cyclic dependency: ${types.join(', ')}, ${ext.type}`
      );
    } else {
      types.push(ext.type);
    }
  }
  if (!ext) {
    ext = { type: options.type };
  }
  return {
    ...ext,
    ...options,
    type: applyTypeAdapters(ext.type)
  };
};

const formatParam = mOptions => param => {
  const { mode, name, type, default: defaultValue } = applyType(
    param,
    mOptions.typeShorthands
  );
  const options = [];
  if (mode) {
    options.push(mode);
  }
  if (name) {
    options.push(mOptions.literal(name));
  }
  if (type) {
    options.push(type);
  }
  if (defaultValue) {
    options.push(`DEFAULT ${escapeValue(defaultValue)}`);
  }
  return options.join(' ');
};

export const formatParams = (params = [], mOptions) =>
  `(${params.map(formatParam(mOptions)).join(', ')})`;

export const comment = (object, name, text) => {
  const cmt = escapeValue(text || null);
  return `COMMENT ON ${object} ${name} IS ${cmt};`;
};

export const formatLines = (lines, replace = '  ', separator = ',') =>
  lines
    .map(line => line.replace(/(?:\r\n|\r|\n)+/g, ' '))
    .join(`${separator}\n`)
    .replace(/^/gm, replace);

export const promisify = fn => (...args) =>
  new Promise((resolve, reject) =>
    fn.call(this, ...args, (err, ...result) =>
      err ? reject(err) : resolve(...result)
    )
  );
