// The code of generated migrations: `pgm` calls whose arguments are strings,
// numbers, booleans, `pgm.func(…)` calls, objects and arrays. Each value
// knows its one-line form; `statement()` prints a call on one line when it
// fits in `WIDTH` columns and otherwise breaks it the way Prettier would
// (arguments, objects and arrays one entry per line, two-space indentation,
// trailing commas in multi-line objects and arrays, none after the last
// argument). The output only depends on the values, so it is deterministic.

import { tsString } from './literals';

/**
 * The widest line of a step before `renderMigration()` indents it by two
 * spaces inside `up`, so that most lines of the file fit in 80 columns.
 * Strings are never broken, so a line with a long string is longer.
 */
const WIDTH = 78;

/**
 * An argument of a `pgm` call, or a part of one.
 */
export type Code =
  | {
      /**
       * Code that is written as it is, e.g. a string literal or `true`.
       */
      readonly kind: 'raw';
      readonly text: string;
    }
  | {
      readonly kind: 'object';

      /**
       * The properties, in order: the key as code (see {@link propertyKey})
       * and the value.
       */
      readonly entries: ReadonlyArray<readonly [string, Code]>;

      /**
       * The object on one line.
       */
      readonly text: string;
    }
  | {
      readonly kind: 'array';
      readonly items: ReadonlyArray<Code>;

      /**
       * The array on one line.
       */
      readonly text: string;
    };

/**
 * Code written as it is.
 *
 * @param text The code.
 */
export function raw(text: string): Code {
  return { kind: 'raw', text };
}

/**
 * A string literal (see `tsString()`).
 *
 * @param value The string.
 */
export function str(value: string): Code {
  return raw(tsString(value));
}

/**
 * A number literal.
 *
 * @param value The number.
 */
export function num(value: number): Code {
  return raw(String(value));
}

/**
 * `pgm.func(<expression>)`: SQL that `pgm` writes without quoting it, e.g. a
 * default.
 *
 * @param expression The SQL expression.
 */
export function func(expression: string): Code {
  return raw(`pgm.func(${tsString(expression)})`);
}

const IDENTIFIER = /^[$A-Z_a-z][\w$]*$/;

/**
 * The code of a property key: the name itself when it is an identifier, a
 * string literal otherwise, and `['__proto__']` for `__proto__` (a plain
 * `__proto__:` key would set the prototype instead of making a property).
 *
 * @param name The name of the property.
 */
export function propertyKey(name: string): string {
  if (name === '__proto__') {
    return `[${tsString(name)}]`;
  }

  return IDENTIFIER.test(name) ? name : tsString(name);
}

/**
 * An object literal. Entries whose value is `undefined` are left out, so
 * optional options can be given as they are.
 *
 * @param entries The property names and values, in order.
 */
export function object(
  entries: ReadonlyArray<readonly [string, Code | undefined]>
): Code {
  const kept: Array<readonly [string, Code]> = [];
  for (const [name, value] of entries) {
    if (value !== undefined) {
      kept.push([propertyKey(name), value]);
    }
  }

  const text =
    kept.length === 0
      ? '{}'
      : `{ ${kept.map(([key, value]) => `${key}: ${value.text}`).join(', ')} }`;

  return { kind: 'object', entries: kept, text };
}

/**
 * An array literal.
 *
 * @param items The items, in order.
 */
export function array(items: ReadonlyArray<Code>): Code {
  return {
    kind: 'array',
    items,
    text: `[${items.map((item) => item.text).join(', ')}]`,
  };
}

/**
 * Whether an object or array has anything in it.
 *
 * @param code The value.
 */
export function isEmpty(code: Code): boolean {
  if (code.kind === 'object') {
    return code.entries.length === 0;
  }

  return code.kind === 'array' && code.items.length === 0;
}

function spaces(count: number): string {
  return ' '.repeat(count);
}

/**
 * Prints a value that starts at `column` of a line indented by `indent`
 * spaces and is followed by `reserve` more characters on its last line.
 */
function print(
  code: Code,
  indent: number,
  column: number,
  reserve: number
): string {
  if (code.kind === 'raw' || column + code.text.length + reserve <= WIDTH) {
    return code.text;
  }

  const inner = indent + 2;
  const lines =
    code.kind === 'object'
      ? code.entries.map(
          ([key, value]) =>
            `${spaces(inner)}${key}: ${print(value, inner, inner + key.length + 2, 1)},`
        )
      : code.items.map(
          (item) => `${spaces(inner)}${print(item, inner, inner, 1)},`
        );
  const [open, close] = code.kind === 'object' ? ['{', '}'] : ['[', ']'];

  return [open, ...lines, `${spaces(indent)}${close}`].join('\n');
}

/**
 * A statement that calls a `pgm` method, e.g. `pgm.createTable(…);`, on one
 * line when it fits and else broken over several lines.
 *
 * @param method The method of `pgm`, e.g. `createTable`.
 * @param args The arguments.
 */
export function statement(method: string, args: ReadonlyArray<Code>): string {
  const callee = `pgm.${method}(`;
  const flat = `${callee}${args.map((arg) => arg.text).join(', ')});`;
  const last = args.at(-1);
  if (
    flat.length <= WIDTH ||
    last === undefined ||
    (args.length === 1 && last.kind === 'raw')
  ) {
    return flat;
  }

  // Keep the leading arguments on the first line and break only the last
  // one, when it is an object or an array and the rest fits.
  const head = `${callee}${args
    .slice(0, -1)
    .map((arg) => `${arg.text}, `)
    .join('')}`;
  if (last.kind !== 'raw' && head.length + 1 <= WIDTH) {
    return `${head}${print(last, 0, head.length, 2)});`;
  }

  const lines = args.map(
    (arg, index) =>
      `  ${print(arg, 2, 2, index < args.length - 1 ? 1 : 0)}${index < args.length - 1 ? ',' : ''}`
  );

  return [callee, ...lines, ');'].join('\n');
}
