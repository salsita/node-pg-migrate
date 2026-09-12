/**
 * The SQL side of the fake server of `fakeServer.ts`: a tokenizer, a parser
 * for the `SELECT`s it understands, and small helpers that behave like their
 * PostgreSQL counterparts.
 */

/**
 * A token of a SQL statement.
 */
export type Token =
  | { readonly type: 'word'; readonly value: string }
  | { readonly type: 'ident'; readonly value: string }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'param'; readonly value: number }
  | { readonly type: 'op'; readonly value: string };

/**
 * A relation named in SQL: stored names, and the text as written.
 */
export interface RelationRef {
  readonly schema?: string;
  readonly name: string;
  readonly text: string;
}

/**
 * An expression of a `SELECT`.
 */
export type Expr =
  | { readonly kind: 'literal'; readonly value: unknown }
  | { readonly kind: 'param'; readonly index: number }
  | { readonly kind: 'column'; readonly name: string }
  | { readonly kind: 'star' }
  | {
      readonly kind: 'call';
      readonly name: string;
      readonly args: ReadonlyArray<Expr>;
      readonly star: boolean;
    }
  | { readonly kind: 'cast'; readonly expr: Expr; readonly type: string }
  | {
      readonly kind: 'binary';
      readonly op: string;
      readonly left: Expr;
      readonly right: Expr;
    }
  | { readonly kind: 'not'; readonly expr: Expr }
  | { readonly kind: 'isNull'; readonly expr: Expr; readonly negated: boolean }
  | {
      readonly kind: 'in';
      readonly expr: Expr;
      readonly list: ReadonlyArray<Expr>;
      readonly negated: boolean;
    }
  | {
      readonly kind: 'case';
      readonly branches: ReadonlyArray<{
        readonly condition: Expr;
        readonly result: Expr;
      }>;
      readonly otherwise?: Expr;
    }
  | { readonly kind: 'subquery'; readonly select: SelectStatement }
  | { readonly kind: 'exists'; readonly select: SelectStatement };

/**
 * A parsed `SELECT`.
 */
export interface SelectStatement {
  readonly items: ReadonlyArray<{
    readonly expr: Expr;
    readonly alias: string;
  }>;
  readonly from?: RelationRef;
  readonly where?: Expr;
}

/**
 * SQL `NULL`.
 */
export const NULL_LITERAL: Expr = { kind: 'literal', value: null };

const OPERATORS = [
  '::',
  '||',
  '<>',
  '!=',
  '>=',
  '<=',
  '=',
  '<',
  '>',
  '(',
  ')',
  ',',
  '.',
  ';',
  '*',
  '+',
  '-',
  '/',
];

/**
 * Words that end an expression instead of being an alias.
 */
const RESERVED = new Set([
  'from',
  'where',
  'and',
  'or',
  'not',
  'is',
  'in',
  'as',
  'then',
  'else',
  'end',
  'when',
]);

/**
 * Reads a quoted string or identifier that starts at `start` (on the quote),
 * with doubled quotes inside.
 *
 * @returns The text between the quotes and the offset after the closing one.
 */
function readQuoted(
  text: string,
  start: number,
  quote: string
): { value: string; end: number } {
  let value = '';
  let index = start + 1;

  while (index < text.length) {
    const char = text.charAt(index);
    const doubled = char === quote && text.charAt(index + 1) === quote;
    if (char === quote && !doubled) {
      return { value, end: index + 1 };
    }

    value += char;
    index += doubled ? 2 : 1;
  }

  throw new Error(`fake server: unterminated ${quote} quote in ${text}`);
}

/**
 * Splits SQL into tokens, skipping whitespace and comments.
 */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < sql.length) {
    const rest = sql.slice(index);
    const char = sql.charAt(index);
    const dollarTag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(rest)?.[0];

    if (/\s/.test(char)) {
      index += 1;
    } else if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', index);
      index = end < 0 ? sql.length : end + 1;
    } else if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', index + 2);
      if (end < 0) {
        throw new Error('fake server: unterminated comment');
      }

      index = end + 2;
    } else if (char === "'" || char === '"') {
      const { value, end } = readQuoted(sql, index, char);
      tokens.push({ type: char === "'" ? 'string' : 'ident', value });
      index = end;
    } else if (/^\$\d/.test(rest)) {
      const digits = /^\$(\d+)/.exec(rest)?.[1] ?? '';
      tokens.push({ type: 'param', value: Number(digits) });
      index += digits.length + 1;
    } else if (dollarTag !== undefined) {
      const end = sql.indexOf(dollarTag, index + dollarTag.length);
      if (end < 0) {
        throw new Error('fake server: unterminated dollar quote');
      }

      tokens.push({
        type: 'string',
        value: sql.slice(index + dollarTag.length, end),
      });
      index = end + dollarTag.length;
    } else if (/\d/.test(char)) {
      const number = /^\d+(?:\.\d+)?/.exec(rest)?.[0] ?? char;
      tokens.push({ type: 'number', value: Number(number) });
      index += number.length;
    } else if (/[A-Za-z_]/.test(char)) {
      const word = /^[A-Za-z_][\w$]*/.exec(rest)?.[0] ?? char;
      tokens.push({ type: 'word', value: word.toLowerCase() });
      index += word.length;
    } else {
      const op = OPERATORS.find((candidate) => rest.startsWith(candidate));
      if (op === undefined) {
        throw new Error(`fake server: unsupported character ${char} in ${sql}`);
      }

      tokens.push({ type: 'op', value: op });
      index += op.length;
    }
  }

  return tokens;
}

/**
 * The keyword at a token, lower case, or `''`.
 */
export function keywordAt(tokens: ReadonlyArray<Token>, index: number): string {
  const token = tokens[index];

  return token?.type === 'word' ? token.value : '';
}

/**
 * Whether nothing but an optional `;` follows.
 */
export function isStatementEnd(
  tokens: ReadonlyArray<Token>,
  index: number
): boolean {
  const token = tokens[index];

  return (
    token === undefined ||
    (token.type === 'op' && token.value === ';' && index === tokens.length - 1)
  );
}

/**
 * What a transaction control statement does: `begin` starts a transaction,
 * `end` ends it, `set` changes it; `undefined` for other statements.
 */
export function transactionControl(
  tokens: ReadonlyArray<Token>
): 'begin' | 'end' | 'set' | undefined {
  const first = keywordAt(tokens, 0);
  const second = keywordAt(tokens, 1);

  if (first === 'begin' || (first === 'start' && second === 'transaction')) {
    return 'begin';
  }

  if (['rollback', 'abort', 'commit', 'end'].includes(first)) {
    return 'end';
  }

  if (
    first === 'set' &&
    (second === 'transaction' || second === 'local' || second === 'session')
  ) {
    return 'set';
  }

  return undefined;
}

/**
 * The name PostgreSQL gives a column without an alias.
 */
export function defaultName(expr: Expr): string {
  switch (expr.kind) {
    case 'column':
    case 'call': {
      return expr.name;
    }

    case 'cast': {
      const inner = defaultName(expr.expr);

      return inner === '?column?' ? expr.type : inner;
    }

    case 'subquery': {
      return expr.select.items[0]?.alias ?? '?column?';
    }

    case 'case':
    case 'exists': {
      return expr.kind;
    }

    case 'literal':
    case 'param':
    case 'star':
    case 'binary':
    case 'not':
    case 'isNull':
    case 'in': {
      return '?column?';
    }
  }

  throw new Error('fake server: unknown expression');
}

/**
 * Whether an expression has an aggregate outside subqueries.
 */
export function containsAggregate(expr: Expr): boolean {
  switch (expr.kind) {
    case 'call': {
      return expr.name === 'count' || expr.args.some(containsAggregate);
    }

    case 'cast':
    case 'not':
    case 'isNull': {
      return containsAggregate(expr.expr);
    }

    case 'binary': {
      return containsAggregate(expr.left) || containsAggregate(expr.right);
    }

    case 'in': {
      return containsAggregate(expr.expr) || expr.list.some(containsAggregate);
    }

    case 'case': {
      return (
        expr.branches.some(
          ({ condition, result }) =>
            containsAggregate(condition) || containsAggregate(result)
        ) ||
        (expr.otherwise !== undefined && containsAggregate(expr.otherwise))
      );
    }

    case 'literal':
    case 'param':
    case 'column':
    case 'star':
    case 'subquery':
    case 'exists': {
      return false;
    }
  }

  throw new Error('fake server: unknown expression');
}

/**
 * Reads one part of a `regclass` input: a quoted identifier as it is, an
 * unquoted one folded to lower case.
 */
function readNamePart(
  text: string,
  start: number
): { part: string; end: number } {
  if (text.charAt(start) === '"') {
    const { value, end } = readQuoted(text, start, '"');

    return { part: value, end };
  }

  const word = /^[^\s".]+/.exec(text.slice(start))?.[0];
  if (
    word === undefined ||
    !(/^[A-Za-z_]/.test(word) || (word.codePointAt(0) ?? 0) > 127)
  ) {
    throw new Error('invalid name syntax');
  }

  return { part: word.toLowerCase(), end: start + word.length };
}

/**
 * Parses the text of a `regclass` input, e.g. `"App"."T"` or `public.t`, the
 * way PostgreSQL does: unquoted parts fold to lower case, quoted ones are
 * exact, and an unqualified name is looked up in `public`.
 *
 * @throws Throws `invalid name syntax` for anything else.
 */
export function parseRelationText(text: string): RelationRef {
  const parts: string[] = [];
  let index = 0;

  for (;;) {
    while (text.charAt(index) === ' ') {
      index += 1;
    }

    const { part, end } = readNamePart(text, index);
    parts.push(part);
    index = end;
    while (text.charAt(index) === ' ') {
      index += 1;
    }

    if (index >= text.length) {
      break;
    }

    if (text.charAt(index) !== '.') {
      throw new Error('invalid name syntax');
    }

    index += 1;
  }

  const [first = '', second, third] = parts;
  if (third !== undefined) {
    throw new Error('fake server: unsupported cross-database reference');
  }

  return second === undefined
    ? { name: first, text }
    : { schema: first, name: second, text };
}

/**
 * The text of a value.
 */
export function stringOf(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * `null` when the value is SQL `NULL`, else `fn(value)`.
 */
export function nullOr(
  value: unknown,
  fn: (value: unknown) => unknown
): unknown {
  return value == null ? null : fn(value);
}

/**
 * Quotes an identifier unless it is a plain lower-case one, like
 * `quote_ident()`.
 */
export function quoteIdent(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name)
    ? name
    : `"${name.replaceAll('"', '""')}"`;
}

/**
 * `format()` with `%I`, `%L`, `%s` and `%%`.
 */
export function formatText(
  template: string,
  args: ReadonlyArray<unknown>
): string {
  let next = 0;

  return template.replaceAll(/%([%ILs])/g, (_, spec: string) => {
    if (spec === '%') {
      return '%';
    }

    const value = args[next];
    next += 1;
    if (value == null) {
      return spec === 'L' ? 'NULL' : '';
    }

    if (spec === 'I') {
      return quoteIdent(stringOf(value));
    }

    return spec === 'L'
      ? `'${stringOf(value).replaceAll("'", "''")}'`
      : stringOf(value);
  });
}

/**
 * A recursive-descent parser for the `SELECT`s the fake server understands.
 */
export class Parser {
  readonly #tokens: ReadonlyArray<Token>;

  #index = 0;

  constructor(tokens: ReadonlyArray<Token>) {
    this.#tokens = tokens;
  }

  /**
   * Parses a whole `SELECT` statement.
   */
  statement(): SelectStatement {
    const select = this.select();
    this.#acceptOp(';');
    if (this.#index < this.#tokens.length) {
      throw new Error(
        `fake server: unsupported SQL at token ${String(this.#index)}`
      );
    }

    return select;
  }

  /**
   * Parses a `SELECT`, e.g. of a subquery.
   */
  select(): SelectStatement {
    this.#expectWord('select');
    const items: Array<{ expr: Expr; alias: string }> = [];
    do {
      if (this.#acceptOp('*')) {
        items.push({ expr: { kind: 'star' }, alias: '*' });
      } else {
        const expr = this.#expression();
        items.push({ expr, alias: this.#alias() ?? defaultName(expr) });
      }
    } while (this.#acceptOp(','));

    let from: RelationRef | undefined;
    if (this.#acceptWord('from')) {
      this.#acceptWord('only');
      from = this.#relation();
      this.#alias();
    }

    const where = this.#acceptWord('where') ? this.#expression() : undefined;

    return { items, from, where };
  }

  #alias(): string | undefined {
    const explicit = this.#acceptWord('as');
    const token = this.#tokens[this.#index];

    if (
      token?.type === 'ident' ||
      (token?.type === 'word' && (explicit || !RESERVED.has(token.value)))
    ) {
      this.#index += 1;

      return token.value;
    }

    if (explicit) {
      throw new Error('fake server: missing alias after AS');
    }

    return undefined;
  }

  #relation(): RelationRef {
    const first = this.#identifier();
    if (this.#acceptOp('.')) {
      const second = this.#identifier();

      return { schema: first, name: second, text: `${first}.${second}` };
    }

    return { name: first, text: first };
  }

  #identifier(): string {
    const token = this.#tokens[this.#index];
    if (token?.type !== 'word' && token?.type !== 'ident') {
      throw new Error('fake server: expected an identifier');
    }

    this.#index += 1;

    return token.value;
  }

  #expression(): Expr {
    let left = this.#conjunction();
    while (this.#acceptWord('or')) {
      left = { kind: 'binary', op: 'or', left, right: this.#conjunction() };
    }

    return left;
  }

  #conjunction(): Expr {
    let left = this.#negation();
    while (this.#acceptWord('and')) {
      left = { kind: 'binary', op: 'and', left, right: this.#negation() };
    }

    return left;
  }

  #negation(): Expr {
    return this.#acceptWord('not')
      ? { kind: 'not', expr: this.#negation() }
      : this.#comparison();
  }

  #comparison(): Expr {
    const left = this.#concatenation();

    if (this.#acceptWord('is')) {
      const negated = this.#acceptWord('not');
      this.#expectWord('null');

      return { kind: 'isNull', expr: left, negated };
    }

    const negated =
      keywordAt(this.#tokens, this.#index) === 'not' &&
      keywordAt(this.#tokens, this.#index + 1) === 'in';
    if (negated) {
      this.#index += 1;
    }

    if (this.#acceptWord('in')) {
      this.#expectOp('(');
      const list: Expr[] = [];
      do {
        list.push(this.#expression());
      } while (this.#acceptOp(','));
      this.#expectOp(')');

      return { kind: 'in', expr: left, list, negated };
    }

    const op = ['=', '<>', '!='].find((candidate) => this.#acceptOp(candidate));

    return op === undefined
      ? left
      : { kind: 'binary', op, left, right: this.#concatenation() };
  }

  #concatenation(): Expr {
    let left = this.#postfix();
    while (this.#acceptOp('||')) {
      left = { kind: 'binary', op: '||', left, right: this.#postfix() };
    }

    return left;
  }

  #postfix(): Expr {
    let expr = this.#primary();
    while (this.#acceptOp('::')) {
      expr = { kind: 'cast', expr, type: this.#typeName() };
    }

    return expr;
  }

  #typeName(): string {
    if (this.#acceptWord('pg_catalog')) {
      this.#expectOp('.');
    }

    const word = this.#identifier();
    let type = word;
    if (word === 'double' && this.#acceptWord('precision')) {
      type = 'double precision';
    } else if (word === 'character' && this.#acceptWord('varying')) {
      type = 'character varying';
    }

    if (this.#acceptOp('(')) {
      while (!this.#acceptOp(')')) {
        this.#index += 1;
      }
    }

    return type;
  }

  #primary(): Expr {
    const token = this.#tokens[this.#index];
    if (token === undefined) {
      throw new Error('fake server: unexpected end of SQL');
    }

    this.#index += 1;

    if (token.type === 'string' || token.type === 'number') {
      return { kind: 'literal', value: token.value };
    }

    if (token.type === 'param') {
      return { kind: 'param', index: token.value };
    }

    if (token.type === 'ident') {
      return this.#qualified(token.value);
    }

    if (token.type === 'word') {
      return this.#word(token.value);
    }

    if (token.value !== '(') {
      throw new Error(`fake server: unexpected ${token.value}`);
    }

    if (keywordAt(this.#tokens, this.#index) === 'select') {
      const select = this.select();
      this.#expectOp(')');

      return { kind: 'subquery', select };
    }

    const expr = this.#expression();
    this.#expectOp(')');

    return expr;
  }

  #word(word: string): Expr {
    if (word === 'null') {
      return NULL_LITERAL;
    }

    if (word === 'true' || word === 'false') {
      return { kind: 'literal', value: word === 'true' };
    }

    if (word === 'case') {
      const branches: Array<{ condition: Expr; result: Expr }> = [];
      while (this.#acceptWord('when')) {
        const condition = this.#expression();
        this.#expectWord('then');
        branches.push({ condition, result: this.#expression() });
      }

      const otherwise = this.#acceptWord('else')
        ? this.#expression()
        : undefined;
      this.#expectWord('end');

      return { kind: 'case', branches, otherwise };
    }

    if (word === 'exists') {
      this.#expectOp('(');
      const select = this.select();
      this.#expectOp(')');

      return { kind: 'exists', select };
    }

    return this.#qualified(word);
  }

  #qualified(name: string): Expr {
    const last = this.#acceptOp('.') ? this.#identifier() : name;

    if (!this.#acceptOp('(')) {
      return { kind: 'column', name: last };
    }

    if (this.#acceptOp('*')) {
      this.#expectOp(')');

      return { kind: 'call', name: last, args: [], star: true };
    }

    const args: Expr[] = [];
    if (!this.#acceptOp(')')) {
      do {
        args.push(this.#expression());
      } while (this.#acceptOp(','));
      this.#expectOp(')');
    }

    return { kind: 'call', name: last, args, star: false };
  }

  #acceptOp(value: string): boolean {
    const token = this.#tokens[this.#index];
    if (token?.type === 'op' && token.value === value) {
      this.#index += 1;

      return true;
    }

    return false;
  }

  #expectOp(value: string): void {
    if (!this.#acceptOp(value)) {
      throw new Error(`fake server: expected ${value}`);
    }
  }

  #acceptWord(value: string): boolean {
    if (keywordAt(this.#tokens, this.#index) === value) {
      this.#index += 1;

      return true;
    }

    return false;
  }

  #expectWord(value: string): void {
    if (!this.#acceptWord(value)) {
      throw new Error(`fake server: expected ${value.toUpperCase()}`);
    }
  }
}
