import type { SegmentKind, TopLevelSegment } from '../types';
import { codeAt, foldIdentifier, Lexer, wordEquals } from './lexer';

const BACKSLASH = 0x5c;
const OPEN_PARENTHESIS = 0x28;
const CLOSE_PARENTHESIS = 0x29;
const SEMICOLON = 0x3b;
const DOT = 0x2e;
const CARRIAGE_RETURN = 0x0d;

/**
 * The kinds of routine that `CREATE` or `CREATE OR REPLACE` can start and
 * that can have a `BEGIN ATOMIC … END` body.
 */
const ROUTINE_KINDS: ReadonlySet<string> = new Set(['function', 'procedure']);

/**
 * Whether the first words of a statement (folded to lower case) are
 * `CREATE [OR REPLACE] FUNCTION|PROCEDURE`.
 */
function isRoutineHead(words: ReadonlyArray<string>): boolean {
  const [first, second = '', third, fourth = ''] = words;
  if (first !== 'create') {
    return false;
  }

  return second === 'or'
    ? third === 'replace' && ROUTINE_KINDS.has(fourth)
    : ROUTINE_KINDS.has(second);
}

/**
 * Follows the tokens of one statement to find where it ends, with psql's
 * rules: a `;` only ends it outside parentheses and, in a
 * `CREATE [OR REPLACE] FUNCTION|PROCEDURE` statement, outside its
 * `BEGIN ATOMIC … END` body. Once `BEGIN ATOMIC` is seen there, each `BEGIN`
 * and `CASE` opens a block and each `END` closes one (outside parentheses).
 *
 * It also notices a `COPY … FROM STDIN` statement, whose data follows it.
 */
class StatementTracker {
  /**
   * Whether the statement is `COPY … FROM STDIN`.
   */
  copyFromStdin = false;

  readonly #text: string;

  /**
   * The first four words, folded to lower case.
   */
  readonly #head: string[] = [];

  #routine = false;

  /**
   * How deep in parentheses the current token is.
   */
  #depth = 0;

  /**
   * How deep in the `BEGIN ATOMIC` body the current token is.
   */
  #atomic = 0;

  /**
   * The previous token, when it is a word that the next one completes.
   */
  #previous: 'begin' | 'from' | undefined;

  /**
   * @param text The text the tokens are read from.
   */
  constructor(text: string) {
    this.#text = text;
  }

  /**
   * Takes the current token of `lexer` into account.
   *
   * @param lexer A lexer over the text of the tracker.
   * @returns Whether the token ends the statement.
   */
  feed(lexer: Lexer): boolean {
    const previous = this.#previous;
    this.#previous = undefined;
    if (lexer.kind === 'word') {
      this.#word(lexer.start, lexer.end, previous);

      return false;
    }

    return (
      lexer.kind === 'symbol' && this.#symbol(codeAt(this.#text, lexer.start))
    );
  }

  #is(start: number, end: number, keyword: string): boolean {
    return wordEquals(this.#text, start, end, keyword);
  }

  #word(start: number, end: number, previous: string | undefined): void {
    if (this.#head.length < 4) {
      this.#head.push(foldIdentifier(this.#text.slice(start, end)));
      this.#routine = isRoutineHead(this.#head);
    }

    if (this.#depth > 0) {
      return;
    }

    if (this.#head[0] === 'copy') {
      this.#copyWord(start, end, previous);
    } else if (this.#routine) {
      this.#routineWord(start, end, previous);
    }
  }

  #copyWord(start: number, end: number, previous: string | undefined): void {
    if (previous === 'from' && this.#is(start, end, 'stdin')) {
      this.copyFromStdin = true;
    } else if (this.#is(start, end, 'from')) {
      this.#previous = 'from';
    }
  }

  #routineWord(start: number, end: number, previous: string | undefined): void {
    if (this.#atomic > 0) {
      this.#atomic += this.#blockChange(start, end);
    } else if (previous === 'begin' && this.#is(start, end, 'atomic')) {
      this.#atomic = 1;
    } else if (this.#is(start, end, 'begin')) {
      this.#previous = 'begin';
    }
  }

  /**
   * `1` for a word that opens a block of a `BEGIN ATOMIC` body, `-1` for one
   * that closes it, `0` for any other.
   */
  #blockChange(start: number, end: number): number {
    if (this.#is(start, end, 'begin') || this.#is(start, end, 'case')) {
      return 1;
    }

    return this.#is(start, end, 'end') ? -1 : 0;
  }

  #symbol(code: number): boolean {
    if (code === OPEN_PARENTHESIS) {
      this.#depth += 1;
    } else if (code === CLOSE_PARENTHESIS) {
      this.#depth = Math.max(0, this.#depth - 1);
    }

    return code === SEMICOLON && this.#depth === 0 && this.#atomic === 0;
  }
}

/**
 * Whether a statement is `COPY … FROM STDIN`, whose data follows it: `COPY`
 * is its first word and `FROM STDIN` appears outside parentheses, quotes and
 * comments.
 *
 * @param statement The text of the statement.
 */
export function copiesFromStdin(statement: string): boolean {
  const lexer = new Lexer(statement);
  const tracker = new StatementTracker(statement);
  while (lexer.next() !== undefined) {
    tracker.feed(lexer);
  }

  return tracker.copyFromStdin;
}

/**
 * Reads the statement whose first token is the current token of `lexer`.
 *
 * @returns Where the statement ends (right after its `;`, or at the end of
 * the input), and whether it is a terminated `COPY … FROM STDIN`.
 */
function readStatement(
  sql: string,
  lexer: Lexer
): { readonly end: number; readonly copyData: boolean } {
  const tracker = new StatementTracker(sql);
  do {
    if (tracker.feed(lexer)) {
      return { end: lexer.end, copyData: tracker.copyFromStdin };
    }
  } while (lexer.next() !== undefined);

  return { end: sql.length, copyData: false };
}

/**
 * The offset right after the end of the line that `from` is on (its `\n`
 * included), or the length of `sql`.
 */
function lineEnd(sql: string, from: number): number {
  const newline = sql.indexOf('\n', from);

  return newline === -1 ? sql.length : newline + 1;
}

/**
 * Whether the line `start`…`end` (without its `\n`) is `\.`, the end of COPY
 * data, with an optional `\r` after it.
 */
function isEndOfData(sql: string, start: number, end: number): boolean {
  const length = end - start;

  return (
    codeAt(sql, start) === BACKSLASH &&
    codeAt(sql, start + 1) === DOT &&
    (length === 2 ||
      (length === 3 && codeAt(sql, start + 2) === CARRIAGE_RETURN))
  );
}

/**
 * The offset right after the COPY data that follows the statement ending at
 * `from`: the data starts on the next line and ends with the line that is
 * `\.` (its `\n` included), or at the end of the input.
 */
function copyDataEnd(sql: string, from: number): number {
  let start = lineEnd(sql, from);
  while (start < sql.length) {
    const newline = sql.indexOf('\n', start);
    const end = newline === -1 ? sql.length : newline;
    if (isEndOfData(sql, start, end)) {
      return Math.min(end + 1, sql.length);
    }

    start = end + 1;
  }

  return sql.length;
}

/**
 * A function that gives the 1-based line of an offset. The offsets it is
 * asked about must not decrease; then it counts each `\n` once.
 */
function lineCounter(sql: string): (offset: number) => number {
  let line = 1;
  let next = sql.indexOf('\n');

  return (offset) => {
    while (next !== -1 && next < offset) {
      line += 1;
      next = sql.indexOf('\n', next + 1);
    }

    return line;
  };
}

/**
 * Splits a SQL script, such as a pg_dump output, into its top-level
 * statements, psql meta-commands, `COPY` data, and the whitespace and comments
 * between them.
 *
 * The texts of the segments concatenate to the input exactly. A `;` only ends
 * a statement at the top level: not inside strings (`'…'`, `E'…'`), quoted
 * identifiers, dollar-quoted bodies or comments, not inside parentheses, and
 * not inside the `BEGIN ATOMIC … END` body of a function or procedure (psql's
 * rules). A backslash outside of a statement starts a meta-command that runs
 * to the end of its line; inside a statement it is part of the statement.
 * Runs in linear time.
 *
 * @param sql The SQL script.
 * @returns The segments, in the order of the input.
 */
export function scanTopLevel(sql: string): TopLevelSegment[] {
  const segments: TopLevelSegment[] = [];
  const lineAt = lineCounter(sql);
  const lexer = new Lexer(sql);
  let position = 0;

  const push = (kind: SegmentKind, end: number): void => {
    if (end > position) {
      segments.push({
        kind,
        text: sql.slice(position, end),
        start: position,
        line: lineAt(position),
      });
      position = end;
    }
  };

  while (lexer.next() !== undefined) {
    push('trivia', lexer.start);
    if (codeAt(sql, lexer.start) === BACKSLASH) {
      push('meta', lineEnd(sql, lexer.start));
    } else {
      const { end, copyData } = readStatement(sql, lexer);
      push('statement', end);
      if (copyData) {
        push('copy-data', copyDataEnd(sql, end));
      }
    }

    lexer.end = position;
  }

  push('trivia', sql.length);

  return segments;
}
