import type {
  Routine,
  RoutineArgument,
  RoutineSetting,
} from '../../introspect/types';
import type { Code } from '../code';
import { array, func, object, raw, statement, str } from '../code';
import { nameCode } from '../names';
import { quoteIdentifier, quoteLiteral, terminated } from '../sql';
import type { EmitContext, Emitted } from '../types';
import { emitFallback } from './fallback';

/**
 * The settings whose value is a list of names (`GUC_LIST_QUOTE` in
 * PostgreSQL): `proconfig` keeps the double quotes of their elements.
 */
const LIST_SETTINGS: ReadonlySet<string> = new Set([
  'local_preload_libraries',
  'search_path',
  'session_preload_libraries',
  'shared_preload_libraries',
  'temp_tablespaces',
  'unix_socket_directories',
]);

/**
 * The languages whose functions are not a body in a string but a symbol of
 * the server or of a shared library (`AS 'obj_file', 'link_symbol'`).
 */
const NATIVE_LANGUAGES: ReadonlySet<string> = new Set(['c', 'internal']);

function isSpace(char: string | undefined): boolean {
  return char !== undefined && ' \t\n\r\f\v'.includes(char);
}

/**
 * One element of a list setting: the element and the offset right after it.
 */
interface ListElement {
  readonly element: string;
  readonly end: number;
}

/**
 * The offset of the first character at or after `from` that is not a space.
 */
function skipSpaces(value: string, from: number): number {
  let index = from;
  while (isSpace(value[index])) {
    index += 1;
  }

  return index;
}

/**
 * Reads the double-quoted element of a list setting whose opening quote is
 * at `from`, with `""` for `"`. `undefined` when it has no closing quote.
 */
function readQuotedElement(
  value: string,
  from: number
): ListElement | undefined {
  let element = '';
  let index = from + 1;
  for (;;) {
    const close = value.indexOf('"', index);
    if (close === -1) {
      return undefined;
    }

    element += value.slice(index, close);
    index = close + 1;
    if (value[index] !== '"') {
      return { element, end: index };
    }

    element += '"';
    index += 1;
  }
}

/**
 * Reads the bare element of a list setting that starts at `from`, up to a
 * comma or a space. `undefined` when it is empty.
 */
function readBareElement(value: string, from: number): ListElement | undefined {
  let index = from;
  while (
    index < value.length &&
    value[index] !== ',' &&
    !isSpace(value[index])
  ) {
    index += 1;
  }

  if (index === from) {
    return undefined;
  }

  return { element: value.slice(from, index), end: index };
}

/**
 * Splits the value of a list setting into its elements like PostgreSQL's
 * `SplitGUCList()`: comma-separated, each element double-quoted (with `""`
 * for `"`) or bare. `undefined` when the value is malformed.
 */
function splitList(value: string): string[] | undefined {
  const elements: string[] = [];
  let index = skipSpaces(value, 0);
  if (index === value.length) {
    return elements;
  }

  for (;;) {
    const read =
      value[index] === '"'
        ? readQuotedElement(value, index)
        : readBareElement(value, index);
    if (read === undefined) {
      return undefined;
    }

    elements.push(read.element);
    index = skipSpaces(value, read.end);
    if (index === value.length) {
      return elements;
    }

    if (value[index] !== ',') {
      return undefined;
    }

    index = skipSpaces(value, index + 1);
  }
}

/**
 * The SQL of the value of a `SET` clause, like `pg_get_functiondef()` writes
 * it: a string constant, or a list of string constants for a list setting
 * (`SET search_path = ''` is stored as `search_path=""` and written `''`).
 */
function settingValue(setting: RoutineSetting): string {
  const elements = LIST_SETTINGS.has(setting.name.toLowerCase())
    ? splitList(setting.value)
    : undefined;
  if (elements === undefined) {
    return quoteLiteral(setting.value);
  }

  return elements.length === 0
    ? "''"
    : elements.map((element) => quoteLiteral(element)).join(', ');
}

function argumentCode(argument: RoutineArgument): Code {
  if (
    argument.mode === 'IN' &&
    argument.name === undefined &&
    argument.default === undefined
  ) {
    return str(argument.type);
  }

  return object([
    ['mode', argument.mode === 'IN' ? undefined : str(argument.mode)],
    ['name', argument.name === undefined ? undefined : str(argument.name)],
    ['type', str(argument.type)],
    [
      'default',
      argument.default === undefined ? undefined : func(argument.default),
    ],
  ]);
}

/**
 * Why a routine needs `pg_get_functiondef()`, in the order of the JSDoc of
 * {@link emitFunction}.
 */
function fallbackReasons(routine: Routine): string[] {
  const reasons: string[] = [];
  if (routine.routineKind === 'procedure') {
    reasons.push('procedure');
  }

  if (routine.hasSqlBody) {
    reasons.push('SQL-standard body');
  }

  if (routine.leakproof) {
    reasons.push('leakproof');
  }

  const native = NATIVE_LANGUAGES.has(routine.language);
  const defaultRows = routine.returnsSet ? 1000 : 0;
  if (routine.cost !== (native ? 1 : 100) || routine.rows !== defaultRows) {
    reasons.push('cost or rows');
  }

  if (routine.support !== undefined) {
    reasons.push('support function');
  }

  if (native) {
    reasons.push(`language ${routine.language}`);
  }

  return reasons;
}

/**
 * Whether {@link emitFunction} creates a routine with `pgm.createFunction`
 * (and its `SET` clauses with the `set` option), rather than with its
 * definition as raw SQL.
 *
 * @param routine The routine.
 */
export function usesCreateFunction(routine: Routine): boolean {
  return fallbackReasons(routine).length === 0;
}

/**
 * `pgm.createFunction(name, params, { returns, language, behavior,
 * security, onNull, parallel, window, set }, body)`, argument defaults as
 * `pgm.func(…)`.
 *
 * Fallback (`pg_get_functiondef`, `definition`) for a procedure, reason
 * `'procedure'`; a SQL-standard body, `'SQL-standard body'`; `LEAKPROOF`,
 * `'leakproof'`; a `COST` or `ROWS` that is not the default, `'cost or
 * rows'`; a planner support function (`SUPPORT`), `'support function'`; a C
 * or internal function, whose body is a symbol rather than source code (`AS
 * 'obj_file', 'link_symbol'`), `'language c'` / `'language internal'`.
 *
 * @param routine The function.
 * @param ctx The migration context.
 */
export function emitFunction(routine: Routine, ctx: EmitContext): Emitted {
  const reasons = fallbackReasons(routine);
  if (reasons.length > 0) {
    return emitFallback(terminated(routine.definition), reasons.join(', '));
  }

  const options = object([
    ['returns', str(routine.returns ?? 'void')],
    ['language', str(quoteIdentifier(routine.language))],
    [
      'behavior',
      routine.volatility === 'VOLATILE' ? undefined : str(routine.volatility),
    ],
    ['security', routine.securityDefiner ? str('DEFINER') : undefined],
    ['onNull', routine.strict ? raw('true') : undefined],
    [
      'parallel',
      routine.parallel === 'UNSAFE' ? undefined : str(routine.parallel),
    ],
    ['window', routine.routineKind === 'window' ? raw('true') : undefined],
    [
      'set',
      routine.config.length === 0
        ? undefined
        : array(
            routine.config.map((setting) =>
              object([
                ['configurationParameter', str(setting.name)],
                ['value', str(settingValue(setting))],
              ])
            )
          ),
    ],
  ]);

  return {
    kind: 'code',
    code: statement('createFunction', [
      nameCode(routine, ctx),
      array(routine.arguments.map(argumentCode)),
      options,
      str(routine.body),
    ]),
  };
}
