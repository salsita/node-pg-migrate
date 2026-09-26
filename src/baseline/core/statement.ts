import type { TopLevelSegment } from '../types';
import type { TokenKind } from './lexer';
import { foldIdentifier, Lexer } from './lexer';

/**
 * A token of a statement.
 */
export interface Token {
  /**
   * What the token is.
   */
  readonly kind: TokenKind;

  /**
   * The offset of the token in the text of its statement.
   */
  readonly start: number;

  /**
   * The offset right after the token in the text of its statement.
   */
  readonly end: number;

  /**
   * The token as written.
   */
  readonly text: string;

  /**
   * For a word, the word folded to lower case like PostgreSQL folds unquoted
   * identifiers, e.g. `create` for `CREATE`; for any other token, its text.
   */
  readonly folded: string;
}

/**
 * A top-level statement of a dump, with its tokens (whitespace and comments
 * left out), which are only read as far as they are asked for.
 */
export class Statement {
  /**
   * The text of the statement.
   */
  readonly text: string;

  /**
   * The offset of the statement in the dump.
   */
  readonly start: number;

  /**
   * The offset right after the statement in the dump.
   */
  readonly end: number;

  /**
   * The 1-based line of the dump the statement starts on.
   */
  readonly line: number;

  readonly #lexer: Lexer;

  readonly #tokens: Token[] = [];

  /**
   * @param segment The `statement` segment of the dump.
   */
  constructor(segment: TopLevelSegment) {
    this.text = segment.text;
    this.start = segment.start;
    this.end = segment.start + segment.text.length;
    this.line = segment.line;
    this.#lexer = new Lexer(segment.text);
  }

  /**
   * The token at `index` (0 is the first), or `undefined` past the last one.
   *
   * @param index The index of the token.
   */
  token(index: number): Token | undefined {
    const lexer = this.#lexer;
    while (this.#tokens.length <= index) {
      const kind = lexer.next();
      if (kind === undefined) {
        return undefined;
      }

      const text = this.text.slice(lexer.start, lexer.end);
      this.#tokens.push({
        kind,
        start: lexer.start,
        end: lexer.end,
        text,
        folded: kind === 'word' ? foldIdentifier(text) : text,
      });
    }

    return this.#tokens[index];
  }

  /**
   * The unquoted word at `index`, folded to lower case; `undefined` when the
   * token there is something else or there is none.
   *
   * @param index The index of the token.
   */
  word(index: number): string | undefined {
    const token = this.token(index);

    return token?.kind === 'word' ? token.folded : undefined;
  }

  /**
   * Whether the tokens from `index` on are the unquoted `words`, in this
   * order (case-insensitive).
   *
   * @param index The index of the first token.
   * @param words The words, in lower case.
   */
  hasWords(index: number, words: ReadonlyArray<string>): boolean {
    return words.every((word, offset) => this.word(index + offset) === word);
  }

  /**
   * Whether the statement has no token from `index` on but its final `;`.
   *
   * @param index The index of the token.
   */
  endsAt(index: number): boolean {
    const token = this.token(index);

    return (
      token === undefined ||
      (token.text === ';' && this.token(index + 1) === undefined)
    );
  }
}
