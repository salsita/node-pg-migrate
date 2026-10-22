// The lexical rules of PostgreSQL that the baseline scanner and sanitizer
// rely on: whitespace, comments, identifiers, string constants, quoted
// identifiers and dollar quotes, as PostgreSQL's and psql's lexers read them.
// Everything here looks at each character a bounded number of times and uses
// no backtracking regular expression, so it runs in linear time on any input.

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const DOUBLE_QUOTE = 0x22;
const DOLLAR = 0x24;
const SINGLE_QUOTE = 0x27;
const ASTERISK = 0x2a;
const HYPHEN = 0x2d;
const DOT = 0x2e;
const SLASH = 0x2f;
const DIGIT_ZERO = 0x30;
const DIGIT_NINE = 0x39;
const UPPER_A = 0x41;
const UPPER_E = 0x45;
const UPPER_Z = 0x5a;
const BACKSLASH = 0x5c;
const UNDERSCORE = 0x5f;
const LOWER_A = 0x61;
const LOWER_E = 0x65;
const LOWER_Z = 0x7a;
const FIRST_NON_ASCII = 0x80;

/**
 * The character at `index` of `text` as a number: its code point, or `-1`
 * past the end of `text`. (At the second half of a surrogate pair, it is that
 * half.) Every character the lexing rules name is ASCII, so any other one
 * only has to be told apart from them.
 *
 * @param text The text.
 * @param index The offset of the character.
 */
export function codeAt(text: string, index: number): number {
  return text.codePointAt(index) ?? -1;
}

/**
 * What a token of SQL is (see {@link Lexer}):
 *
 * - `word`: an unquoted identifier or keyword, e.g. `CREATE` or `public`.
 * - `quoted`: a double-quoted identifier, e.g. `"Order; Lines"`.
 * - `string`: a string constant: `'…'`, `E'…'` or `$tag$…$tag$`.
 * - `number`: a numeric constant, e.g. `42` or `1.5e3`.
 * - `parameter`: a positional parameter, e.g. `$1`.
 * - `symbol`: any other single character, e.g. `;`, `(`, `.` or `=`.
 */
export type TokenKind =
  | 'word'
  | 'quoted'
  | 'string'
  | 'number'
  | 'parameter'
  | 'symbol';

/**
 * Whether a character is whitespace between tokens: space, tab, line feed,
 * carriage return, form feed or vertical tab (PostgreSQL's `space`).
 *
 * @param code The character (see {@link codeAt}).
 */
export function isSpace(code: number): boolean {
  return code === SPACE || (code >= TAB && code <= CARRIAGE_RETURN);
}

function isDigit(code: number): boolean {
  return code >= DIGIT_ZERO && code <= DIGIT_NINE;
}

function isAsciiLetter(code: number): boolean {
  return (
    (code >= UPPER_A && code <= UPPER_Z) || (code >= LOWER_A && code <= LOWER_Z)
  );
}

/**
 * Whether a character can start an unquoted identifier: an ASCII letter,
 * `_` or any non-ASCII character (PostgreSQL's `ident_start`).
 *
 * @param code The character (see {@link codeAt}).
 */
export function isIdentifierStart(code: number): boolean {
  return isAsciiLetter(code) || code === UNDERSCORE || code >= FIRST_NON_ASCII;
}

/**
 * Whether a character can be part of the tag of a dollar quote: what can
 * start an identifier, and digits.
 */
function isTagPart(code: number): boolean {
  return isIdentifierStart(code) || isDigit(code);
}

/**
 * Whether a character can continue an unquoted identifier: what can be part
 * of a dollar-quote tag, and `$` (PostgreSQL's `ident_cont`).
 */
function isIdentifierPart(code: number): boolean {
  return isTagPart(code) || code === DOLLAR;
}

/**
 * Whether a character can continue a numeric constant. Letters are included
 * so that `1e5` and trailing junk such as `1abc` stay one token.
 */
function isNumberPart(code: number): boolean {
  return isTagPart(code) || code === DOT;
}

/**
 * The offset of the first character from `from` on that `predicate` rejects,
 * or the length of `text`.
 *
 * @param text The text.
 * @param from Where to start.
 * @param predicate Whether a character (see {@link codeAt}) is skipped.
 */
export function skipWhile(
  text: string,
  from: number,
  predicate: (code: number) => boolean
): number {
  let index = from;
  while (index < text.length && predicate(codeAt(text, index))) {
    index += 1;
  }

  return index;
}

/**
 * The offset right after the unquoted identifier that continues at `from`.
 *
 * @param text The text.
 * @param from The offset of the second character of the identifier.
 */
export function skipIdentifier(text: string, from: number): number {
  return skipWhile(text, from, isIdentifierPart);
}

/**
 * The offset of the quote that closes the quoted text starting at `from`
 * (`'…'` or `"…"`), where a doubled quote stands for the quote itself.
 *
 * @param text The text.
 * @param from The offset of the opening quote.
 * @returns The offset of the closing quote, or `-1` when there is none.
 */
export function closingQuote(text: string, from: number): number {
  const quote = text.charAt(from);
  let close = text.indexOf(quote, from + 1);
  while (close !== -1 && text.charAt(close + 1) === quote) {
    close = text.indexOf(quote, close + 2);
  }

  return close;
}

/**
 * The offset right after the quoted text starting at `from`, or the length
 * of `text` when it is not closed.
 */
function skipQuoted(text: string, from: number): number {
  const close = closingQuote(text, from);

  return close === -1 ? text.length : close + 1;
}

/**
 * The offset right after the `E'…'` string whose quote is at `from`: a
 * backslash escapes the character after it, and a doubled quote stands for
 * the quote itself.
 */
function skipEscapeString(text: string, from: number): number {
  let index = from + 1;
  while (index < text.length) {
    const code = codeAt(text, index);
    if (code === BACKSLASH) {
      index += 2;
    } else if (code !== SINGLE_QUOTE) {
      index += 1;
    } else if (codeAt(text, index + 1) === SINGLE_QUOTE) {
      index += 2;
    } else {
      return index + 1;
    }
  }

  return text.length;
}

/**
 * The offset right after the dollar-quote delimiter (`$$` or `$tag$`) that
 * starts at `from`, or `-1` when none does (e.g. at the parameter `$1`).
 */
function dollarDelimiterEnd(text: string, from: number): number {
  let index = from + 1;
  if (isIdentifierStart(codeAt(text, index))) {
    index = skipWhile(text, index + 1, isTagPart);
  }

  return codeAt(text, index) === DOLLAR ? index + 1 : -1;
}

/**
 * The offset of the line break that ends the `--` comment continuing at
 * `from`, or the length of `text`.
 */
function skipLineComment(text: string, from: number): number {
  return skipWhile(
    text,
    from,
    (code) => code !== LINE_FEED && code !== CARRIAGE_RETURN
  );
}

/**
 * The offset right after the block comment whose content (after its opening
 * slash and asterisk) starts at `from`. Block comments nest. Returns the
 * length of `text` when the comment is not closed.
 */
function skipBlockComment(text: string, from: number): number {
  let depth = 1;
  let index = from;
  while (index < text.length) {
    const code = codeAt(text, index);
    const next = codeAt(text, index + 1);
    if (code === ASTERISK && next === SLASH) {
      depth -= 1;
      index += 2;
      if (depth === 0) {
        return index;
      }
    } else if (code === SLASH && next === ASTERISK) {
      depth += 1;
      index += 2;
    } else {
      index += 1;
    }
  }

  return text.length;
}

/**
 * The offset of the first character from `from` on that is neither
 * whitespace nor part of a comment, or the length of `text`.
 *
 * @param text The text.
 * @param from Where to start.
 */
export function skipTrivia(text: string, from: number): number {
  let index = from;
  while (index < text.length) {
    const code = codeAt(text, index);
    const next = codeAt(text, index + 1);
    if (isSpace(code)) {
      index += 1;
    } else if (code === HYPHEN && next === HYPHEN) {
      index = skipLineComment(text, index + 2);
    } else if (code === SLASH && next === ASTERISK) {
      index = skipBlockComment(text, index + 2);
    } else {
      return index;
    }
  }

  return index;
}

/**
 * Folds an unquoted identifier to lower case the way PostgreSQL does in a
 * UTF-8 database: only the ASCII letters `A` to `Z` change.
 *
 * @param identifier The identifier as written, without quotes.
 */
export function foldIdentifier(identifier: string): string {
  return identifier.replaceAll(/[A-Z]+/g, (letters) => letters.toLowerCase());
}

/**
 * Whether the unquoted word at `start`…`end` of `text` is `keyword`, ignoring
 * the case of ASCII letters. It compares in place, without copying the word.
 *
 * @param text The text.
 * @param start The offset of the word.
 * @param end The offset right after the word.
 * @param keyword The keyword, in lower case.
 */
export function wordEquals(
  text: string,
  start: number,
  end: number,
  keyword: string
): boolean {
  if (end - start !== keyword.length) {
    return false;
  }

  for (let index = 0; index < keyword.length; index++) {
    const code = codeAt(text, start + index);
    const folded = code >= UPPER_A && code <= UPPER_Z ? code + 32 : code;
    if (folded !== codeAt(keyword, index)) {
      return false;
    }
  }

  return true;
}

/**
 * A cursor over the tokens of SQL text. Whitespace and comments are skipped;
 * strings, quoted identifiers and dollar-quoted bodies are single tokens, so
 * nothing inside them is ever taken for SQL.
 *
 * Standard strings (`'…'`) take backslashes literally, as they do with
 * `standard_conforming_strings` on (pg_dump sets it). Unterminated strings,
 * quoted identifiers, dollar quotes and comments run to the end of the text.
 */
export class Lexer {
  /**
   * What the current token is: `undefined` before the first call to
   * {@link Lexer.next} and at the end of the text.
   */
  kind: TokenKind | undefined;

  /**
   * The offset of the current token.
   */
  start = 0;

  /**
   * The offset right after the current token, where the next one is looked
   * for. Setting it moves the cursor.
   */
  end = 0;

  readonly #text: string;

  /**
   * @param text The SQL text.
   */
  constructor(text: string) {
    this.#text = text;
  }

  /**
   * Moves to the next token.
   *
   * @returns What the token is, or `undefined` at the end of the text.
   */
  next(): TokenKind | undefined {
    const text = this.#text;
    this.start = skipTrivia(text, this.end);
    this.end = this.start;
    this.kind = this.start < text.length ? this.#read(this.start) : undefined;

    return this.kind;
  }

  /**
   * Reads the token that starts at `start`: sets {@link Lexer.end} and
   * returns its kind.
   */
  #read(start: number): TokenKind {
    const text = this.#text;
    const code = codeAt(text, start);
    if (isIdentifierStart(code)) {
      return this.#readWord(start);
    }

    if (code === SINGLE_QUOTE || code === DOUBLE_QUOTE) {
      this.end = skipQuoted(text, start);

      return code === SINGLE_QUOTE ? 'string' : 'quoted';
    }

    if (code === DOLLAR) {
      return this.#readDollar(start);
    }

    if (isDigit(code)) {
      this.end = skipWhile(text, start + 1, isNumberPart);

      return 'number';
    }

    this.end = start + 1;

    return 'symbol';
  }

  /**
   * Reads an unquoted identifier or keyword, or an `E'…'` string.
   */
  #readWord(start: number): TokenKind {
    const text = this.#text;
    const code = codeAt(text, start);
    if (
      (code === UPPER_E || code === LOWER_E) &&
      codeAt(text, start + 1) === SINGLE_QUOTE
    ) {
      this.end = skipEscapeString(text, start + 1);

      return 'string';
    }

    this.end = skipIdentifier(text, start + 1);

    return 'word';
  }

  /**
   * Reads a dollar-quoted string, a parameter such as `$1`, or a lone `$`.
   */
  #readDollar(start: number): TokenKind {
    const text = this.#text;
    const delimiterEnd = dollarDelimiterEnd(text, start);
    if (delimiterEnd !== -1) {
      const delimiter = text.slice(start, delimiterEnd);
      const close = text.indexOf(delimiter, delimiterEnd);
      this.end = close === -1 ? text.length : close + delimiter.length;

      return 'string';
    }

    this.end = skipWhile(text, start + 1, isDigit);

    return this.end > start + 1 ? 'parameter' : 'symbol';
  }
}
