const BACKSLASH = 0x5c;
const SINGLE_QUOTE = 0x27;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const TAB = 0x09;
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;
const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;
const FIRST_SURROGATE = 0xd800;
const LAST_SURROGATE = 0xdfff;
const LAST_BMP = 0xffff;

/**
 * The escape sequence of a character that a single-quoted literal on one
 * line cannot have as it is, or `undefined` for any other character.
 *
 * @param code The code point (a lone surrogate is its code unit).
 */
function escapeOf(code: number): string | undefined {
  switch (code) {
    case BACKSLASH: {
      return '\\\\';
    }

    case SINGLE_QUOTE: {
      return String.raw`\'`;
    }

    case LINE_FEED: {
      return String.raw`\n`;
    }

    case CARRIAGE_RETURN: {
      return String.raw`\r`;
    }

    case TAB: {
      return String.raw`\t`;
    }

    default: {
      if (
        code < FIRST_PRINTABLE ||
        code === DELETE ||
        code === LINE_SEPARATOR ||
        code === PARAGRAPH_SEPARATOR ||
        (code >= FIRST_SURROGATE && code <= LAST_SURROGATE)
      ) {
        return `\\u${code.toString(16).padStart(4, '0')}`;
      }

      return undefined;
    }
  }
}

/**
 * Writes a string as a JavaScript string literal that evaluates to exactly
 * `value`, in single quotes: backslashes, single quotes, line terminators
 * (`\n`, `\r`, U+2028, U+2029) and other control characters are escaped, so
 * the literal is valid TypeScript and JavaScript on one line. The same value
 * always gives the same literal.
 *
 * Tabs, line feeds and carriage returns become `\t`, `\n` and `\r`; the other
 * control characters, DEL, the two line separators and lone surrogates become
 * `\uXXXX` (never `\0`, which a following digit would turn into an octal
 * escape).
 *
 * @param value The string, e.g. SQL for `pgm.sql()` or an expression for
 * `pgm.func()`.
 * @returns The literal, e.g. `'it\'s'`.
 */
export function tsString(value: string): string {
  let literal = "'";
  let copied = 0;
  let index = 0;
  while (index < value.length) {
    const code = value.codePointAt(index) ?? 0;
    const width = code > LAST_BMP ? 2 : 1;
    const escaped = escapeOf(code);
    if (escaped !== undefined) {
      literal += value.slice(copied, index) + escaped;
      copied = index + width;
    }

    index += width;
  }

  return `${literal}${value.slice(copied)}'`;
}
