import { codeAt, skipWhile, wordEquals } from './lexer';

const HYPHEN = 0x2d;

/**
 * The words that follow `--` in node-pg-migrate's migration markers.
 */
const DIRECTIONS: ReadonlyArray<string> = ['up', 'down'];

/**
 * Where a migration marker was found in a text.
 */
export interface MarkerMatch {
  /**
   * The offset of the `--` that starts the marker.
   */
  readonly start: number;

  /**
   * The offset right after the word `migration` that ends it.
   */
  readonly end: number;
}

/**
 * Whether a character ends a line for a JavaScript regular expression with
 * the `m` flag (`\n`, `\r`, U+2028 and U+2029).
 */
function isLineTerminator(code: number): boolean {
  return code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;
}

/**
 * Whether a character matches `\s` in a JavaScript regular expression.
 */
function isRegExpSpace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

function isSpaceOrHyphen(code: number): boolean {
  return code === HYPHEN || isRegExpSpace(code);
}

/**
 * The offset right after `word` (in lower case) when it is at `from` in any
 * mix of ASCII upper and lower case, `-1` otherwise. That is how a regular
 * expression with the `i` flag and without the `u` flag compares these
 * words.
 */
function wordEnd(text: string, from: number, word: string): number {
  const end = from + word.length;

  return wordEquals(text, from, end, word) ? end : -1;
}

/**
 * Matches `(up|down)\s+migration` at `from`.
 *
 * @returns The offset right after `migration`, or `-1`.
 */
function directionEnd(text: string, from: number): number {
  for (const direction of DIRECTIONS) {
    const end = wordEnd(text, from, direction);
    const spaceEnd = end === -1 ? -1 : skipWhile(text, end, isRegExpSpace);
    if (spaceEnd > end) {
      return wordEnd(text, spaceEnd, 'migration');
    }
  }

  return -1;
}

/**
 * Finds the first place where node-pg-migrate would see an up or down
 * migration marker: what `createMigrationCommentRegex()` of
 * `src/sqlMigration.ts` matches (`^\s*--[\s-]*up\s+migration` or the same
 * with `down`, with the `i` and `m` flags). Like that regular expression it
 * matches a `--` that only whitespace separates from the start of a line,
 * even across blank lines, and it finds the same markers.
 *
 * Unlike that regular expression, which can take quadratic time on many
 * blank lines, this runs in linear time.
 *
 * @param text The text to search.
 * @returns The first marker, or `undefined` when there is none.
 */
export function findMigrationMarker(text: string): MarkerMatch | undefined {
  let atLineStart = true;
  let index = 0;
  while (index < text.length) {
    const code = codeAt(text, index);
    if (isLineTerminator(code)) {
      atLineStart = true;
      index += 1;
    } else if (isRegExpSpace(code)) {
      index += 1;
    } else if (
      atLineStart &&
      code === HYPHEN &&
      codeAt(text, index + 1) === HYPHEN
    ) {
      // Every `--` up to the end of this run of spaces and hyphens would
      // reach the same word after it, so none of them needs another look.
      const runEnd = skipWhile(text, index + 2, isSpaceOrHyphen);
      const end = directionEnd(text, runEnd);
      if (end !== -1) {
        return { start: index, end };
      }

      atLineStart = false;
      index = runEnd;
    } else {
      atLineStart = false;
      index += 1;
    }
  }

  return undefined;
}
