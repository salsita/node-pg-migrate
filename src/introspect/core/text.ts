import type { RoutineSetting } from '../types';

/**
 * What `pg_get_triggerdef()` writes right before the condition of a trigger.
 */
const WHEN_CLAUSE = ' WHEN (';

/**
 * Splits a `proconfig` entry at its first `=`: `'search_path=pg_catalog,
 * pg_temp'` is the setting `search_path` with the value `'pg_catalog,
 * pg_temp'`. An entry without `=` has an empty value.
 *
 * @param entry The entry, as `proconfig` stores it.
 * @returns The setting.
 */
export function splitSetting(entry: string): RoutineSetting {
  const [name, ...value] = entry.split('=');

  return { name, value: value.join('=') };
}

/**
 * Removes the `;` that ends a statement, e.g. the one of `pg_get_viewdef()`.
 *
 * @param text The text.
 * @returns The text without its last character when that is a `;`.
 */
export function withoutFinalSemicolon(text: string): string {
  return text.endsWith(';') ? text.slice(0, -1) : text;
}

/**
 * Decodes the arguments of a trigger from `pg_trigger.tgargs`, where each
 * argument is followed by a zero byte.
 *
 * @param tgargs The bytes of `tgargs`.
 * @returns The arguments, in order, decoded as UTF-8.
 */
export function triggerArguments(tgargs: Uint8Array): string[] {
  const decoder = new TextDecoder();
  const args: string[] = [];
  let start = 0;
  for (const [index, byte] of tgargs.entries()) {
    if (byte === 0) {
      args.push(decoder.decode(tgargs.subarray(start, index)));
      start = index + 1;
    }
  }

  return args;
}

/**
 * Finds where a quoted identifier or string literal that starts at `from`
 * ends. Inside, the quote character is written twice.
 *
 * @param text The text.
 * @param from The offset of the opening quote.
 * @returns The offset of the closing quote, or the length of `text` when
 * there is none.
 */
function closingQuote(text: string, from: number): number {
  const quote = text[from];
  let index = from + 1;
  while (index < text.length) {
    if (text[index] === quote) {
      if (text[index + 1] !== quote) {
        return index;
      }

      index += 1;
    }

    index += 1;
  }

  return text.length;
}

/**
 * Finds the `WHEN (` clause of a trigger definition outside quoted
 * identifiers (a trigger, table or column name can contain those words).
 *
 * @param definition What `pg_get_triggerdef()` returns.
 * @returns The offset right after `WHEN (`, or -1 when there is none.
 */
function conditionStart(definition: string): number {
  let index = 0;
  while (index < definition.length) {
    const character = definition[index];
    if (character === '"' || character === "'") {
      index = closingQuote(definition, index) + 1;
    } else if (definition.startsWith(WHEN_CLAUSE, index)) {
      return index + WHEN_CLAUSE.length;
    } else {
      index += 1;
    }
  }

  return -1;
}

/**
 * Takes the condition of a trigger out of its definition: the text between
 * `WHEN (` and the parenthesis that closes it, skipping parentheses inside
 * quoted identifiers and string literals.
 *
 * @param definition What `pg_get_triggerdef()` returns.
 * @returns The condition, or `undefined` when the definition has none.
 */
export function triggerCondition(definition: string): string | undefined {
  const start = conditionStart(definition);
  if (start === -1) {
    return undefined;
  }

  let depth = 1;
  let index = start;
  while (index < definition.length) {
    const character = definition[index];
    if (character === '"' || character === "'") {
      index = closingQuote(definition, index);
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        return definition.slice(start, index);
      }
    }

    index += 1;
  }

  return undefined;
}
