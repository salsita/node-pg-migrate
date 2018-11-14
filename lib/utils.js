// This is used to create unescaped strings
// exposed in the migrations via pgm.func
class PgLiteral {
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

const schemalize = v => {
  if (typeof v === "object") {
    const { schema, name } = v;
    return (schema ? `${schema}"."` : "") + name;
  }
  return v;
};

const opSchemalize = v => {
  if (typeof v === "object") {
    const { schema, name } = v;
    return schema ? `OPERATOR(${schema}.${name})` : name;
  }
  return v;
};

const t = (s, d) =>
  Object.keys(d || {}).reduce(
    (str, p) => str.replace(new RegExp(`{${p}}`, "g"), schemalize(d[p])), // eslint-disable-line security/detect-non-literal-regexp
    s
  );

const escapeValue = val => {
  if (val === null) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val.toString();
  }
  if (typeof val === "string") {
    let dollars;
    let index = 0;
    do {
      index += 1;
      dollars = `$pg${index}$`;
    } while (val.indexOf(dollars) >= 0);
    return `${dollars}${val}${dollars}`;
  }
  if (typeof val === "number") {
    return val;
  }
  if (Array.isArray(val)) {
    const arrayStr = val
      .map(escapeValue)
      .join(",")
      .replace(/ARRAY/g, "");
    return `ARRAY[${arrayStr}]`;
  }
  if (val instanceof PgLiteral) {
    return val.toString();
  }
  return "";
};

const template = (strings, ...keys) => {
  const result = [strings[0]];
  keys.forEach((key, i) => {
    result.push(schemalize(key), strings[i + 1]);
  });
  return result.join("");
};

const opTemplate = (strings, ...keys) => {
  const result = [strings[0]];
  keys.forEach((key, i) => {
    result.push(opSchemalize(key), strings[i + 1]);
  });
  return result.join("");
};

const getMigrationTableSchema = options =>
  options.migrationsSchema !== undefined // eslint-disable-line no-nested-ternary
    ? options.migrationsSchema
    : options.schema !== undefined
    ? options.schema
    : "public";

const quote = array => array.map(item => template`"${item}"`);

const typeAdapters = {
  int: "integer",
  string: "text",
  float: "real",
  double: "double precision",
  datetime: "timestamp",
  bool: "boolean"
};

const defaultTypeShorthands = {
  id: { type: "serial", primaryKey: true } // convenience type for serial primary keys
};

// some convenience adapters -- see above
const applyTypeAdapters = type =>
  typeAdapters[type] ? typeAdapters[type] : type;

const applyType = (type, extendingTypeShorthands = {}) => {
  const typeShorthands = {
    ...defaultTypeShorthands,
    ...extendingTypeShorthands
  };
  const options = typeof type === "string" ? { type } : type;
  let ext = null;
  const types = [options.type];
  while (typeShorthands[types[types.length - 1]]) {
    if (ext) {
      delete ext.type;
    }
    ext = { ...typeShorthands[types[types.length - 1]], ...ext };
    if (types.includes(ext.type)) {
      throw new Error(
        `Shorthands contain cyclic dependency: ${types.join(", ")}, ${ext.type}`
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

const formatParam = typeShorthands => param => {
  const { mode, name, type, default: defaultValue } = applyType(
    param,
    typeShorthands
  );
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
  return options.join(" ");
};

const formatParams = (params = [], typeShorthands) =>
  `(${params.map(formatParam(typeShorthands)).join(", ")})`;

const comment = (object, name, text) => {
  const cmt = escapeValue(text || null);
  return template`COMMENT ON ${object} "${name}" IS ${cmt};`;
};

const formatLines = (lines, replace = "  ", separator = ",") =>
  lines
    .map(line => line.replace(/(?:\r\n|\r|\n)+/g, " "))
    .join(`${separator}\n`)
    .replace(/^/gm, replace);

const promisify = fn => (...args) =>
  new Promise((resolve, reject) =>
    fn.call(this, ...args, (err, ...result) =>
      err ? reject(err) : resolve(...result)
    )
  );

module.exports = {
  schemalize,
  opSchemalize,
  PgLiteral,
  t,
  escapeValue,
  template,
  opTemplate,
  getMigrationTableSchema,
  quote,
  applyTypeAdapters,
  applyType,
  formatParams,
  comment,
  formatLines,
  promisify
};
