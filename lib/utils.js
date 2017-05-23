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

const schemalize = (v) => {
  if (typeof v === 'object') {
    const schema = v.schema;
    const name = v.name;
    return (schema ? `${schema}"."` : '') + name;
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
    return `'${escape(val)}'`;
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

export const getMigrationTableSchema = options => options.migrations_schema || options.schema || 'public';

export const finallyPromise = func => [
  func,
  (err) => {
    const errHandler = (innerErr) => {
      console.err(
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
