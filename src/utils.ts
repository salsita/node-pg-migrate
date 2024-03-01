import decamelize from 'decamelize';
import type { PgLiteral } from '.';
import type {
  FunctionParam,
  FunctionParamType,
} from './operations/functionsTypes';
import type { Name, Type, Value } from './operations/generalTypes';
import type {
  ColumnDefinition,
  ColumnDefinitions,
} from './operations/tablesTypes';
import type { Literal, MigrationOptions, RunnerOption } from './types';

const identity = <T>(v: T) => v;
const quote = (str: string) => `"${str}"`;

export const createSchemalize = (
  shouldDecamelize: boolean,
  shouldQuote: boolean
): ((v: Name) => string) => {
  const transform = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity,
  ].reduce((acc, fn) => (fn === identity ? acc : (x: string) => acc(fn(x))));
  return (v: Name) => {
    if (typeof v === 'object') {
      const { schema, name } = v;
      return (schema ? `${transform(schema)}.` : '') + transform(name);
    }

    return transform(v);
  };
};

// credits to https://stackoverflow.com/a/12504061/4790644
export class StringIdGenerator {
  private ids: number[] = [0];

  constructor(private readonly chars = 'abcdefghijklmnopqrstuvwxyz') {}

  next(): string {
    const idsChars = this.ids.map((id) => this.chars[id]);
    this.increment();
    return idsChars.join('');
  }

  private increment() {
    for (let i = this.ids.length - 1; i >= 0; i -= 1) {
      this.ids[i] += 1;
      if (this.ids[i] < this.chars.length) {
        return;
      }

      this.ids[i] = 0;
    }

    this.ids.unshift(0);
  }
}

const isPgLiteral = (val: unknown): val is PgLiteral =>
  typeof val === 'object' &&
  val !== null &&
  'literal' in val &&
  (val as { literal: unknown }).literal === true;

export const escapeValue = (val: Value): string | number => {
  if (val === null) {
    return 'NULL';
  }

  if (typeof val === 'boolean') {
    return val.toString();
  }

  if (typeof val === 'string') {
    let dollars: string;
    const ids = new StringIdGenerator();
    let index: string;
    do {
      index = ids.next();
      dollars = `$pg${index}$`;
    } while (val.includes(dollars));

    return `${dollars}${val}${dollars}`;
  }

  if (typeof val === 'number') {
    return val;
  }

  if (Array.isArray(val)) {
    const arrayStr = val.map(escapeValue).join(',').replace(/ARRAY/g, '');
    return `ARRAY[${arrayStr}]`;
  }

  if (isPgLiteral(val)) {
    return val.value;
  }

  return '';
};

export const createTransformer =
  (literal: Literal) =>
  (s: string, d?: { [key: string]: Name | Value }): string =>
    Object.keys(d || {}).reduce((str: string, p) => {
      const v = d?.[p];
      return str.replace(
        new RegExp(`{${p}}`, 'g'),
        v === undefined
          ? ''
          : typeof v === 'string' ||
              (typeof v === 'object' && v !== null && 'name' in v)
            ? literal(v)
            : String(escapeValue(v))
      );
    }, s);

export const getSchemas = (schema?: string | string[]): string[] => {
  const schemas = (Array.isArray(schema) ? schema : [schema]).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
  return schemas.length > 0 ? schemas : ['public'];
};

export const getMigrationTableSchema = (options: RunnerOption): string =>
  options.migrationsSchema !== undefined
    ? options.migrationsSchema
    : getSchemas(options.schema)[0];

const typeAdapters = {
  int: 'integer',
  string: 'text',
  float: 'real',
  double: 'double precision',
  datetime: 'timestamp',
  bool: 'boolean',
} as const;

const defaultTypeShorthands: ColumnDefinitions = {
  id: { type: 'serial', primaryKey: true }, // convenience type for serial primary keys
};

// some convenience adapters -- see above
export const applyTypeAdapters = (type: string): string =>
  type in typeAdapters ? typeAdapters[type as keyof typeof typeAdapters] : type;

const toType = (type: string | ColumnDefinition): ColumnDefinition =>
  typeof type === 'string' ? { type } : type;

const removeType = ({ type, ...rest }: Partial<ColumnDefinition>) => rest;

export const applyType = (
  type: Type,
  extendingTypeShorthands: ColumnDefinitions = {}
): ColumnDefinition & FunctionParamType => {
  const typeShorthands: ColumnDefinitions = {
    ...defaultTypeShorthands,
    ...extendingTypeShorthands,
  };
  const options = toType(type);
  let ext: ColumnDefinition | null = null;
  const types: string[] = [options.type];
  while (typeShorthands[types[types.length - 1]]) {
    ext = {
      ...toType(typeShorthands[types[types.length - 1]]),
      ...(ext === null ? {} : removeType(ext)),
    };
    if (types.includes(ext.type)) {
      throw new Error(
        `Shorthands contain cyclic dependency: ${types.join(', ')}, ${ext.type}`
      );
    } else {
      types.push(ext.type);
    }
  }

  return {
    ...ext,
    ...options,
    type: applyTypeAdapters(ext?.type ?? options.type),
  };
};

const formatParam = (mOptions: MigrationOptions) => (param: FunctionParam) => {
  const {
    mode,
    name,
    type,
    default: defaultValue,
  } = applyType(param, mOptions.typeShorthands);
  const options: string[] = [];
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

export const formatParams = (
  params: FunctionParam[],
  mOptions: MigrationOptions
): string => `(${params.map(formatParam(mOptions)).join(', ')})`;

export const makeComment = (
  object: string,
  name: string,
  text?: string | null
): string => {
  const cmt = escapeValue(text || null);
  return `COMMENT ON ${object} ${name} IS ${cmt};`;
};

export const formatLines = (
  lines: string[],
  replace = '  ',
  separator = ','
): string =>
  lines
    .map((line) => line.replace(/(?:\r\n|\r|\n)+/g, ' '))
    .join(`${separator}\n`)
    .replace(/^/gm, replace);

export function intersection<T>(list1: T[], list2: T[]): T[] {
  return list1.filter((element) => list2.includes(element));
}
