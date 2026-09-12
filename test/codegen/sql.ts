// Canonical SQL for the codegen specs.
//
// The specs compare the SQL that generated code produces with the DDL they
// expect, but only on what matters: two statements are the same when they
// have the same canonical form. The canonical form is tolerant of what the
// contract leaves to the implementation, and of nothing else:
//
// - whitespace, comments and the case of keywords and unquoted identifiers;
// - quotes around identifiers that do not need them (`"orders"` is
//   `orders`), and how a string literal is quoted (`'it''s'`, `E'it\'s'`
//   and `$$it's$$` are the same literal);
// - redundant parentheses (`((a > 0))` is `(a > 0)`) and a `pg_catalog.`
//   qualifier;
// - defaults written or left out: `USING btree`, `ASC`, `WITH DATA`,
//   `PARALLEL UNSAFE`, `IN` arguments, `ONLY` in `ALTER TABLE ONLY`, `FOR ALL`
//   and `TO PUBLIC` in `CREATE POLICY`, sequence options (also those of
//   identity columns), default options of `CREATE AGGREGATE` and
//   `CREATE COLLATION`;
// - synonyms: `EXECUTE PROCEDURE` is `EXECUTE FUNCTION`, and `PROCEDURE =`
//   is `FUNCTION =` in `CREATE OPERATOR`;
// - order: of the options of `CREATE AGGREGATE | COLLATION | OPERATOR` and
//   `CREATE TYPE … AS RANGE`, and of the clauses of a column definition in
//   `CREATE TABLE` (where an implied `NOT NULL` of identity and serial
//   columns is optional), and of storage parameters written as strings.

/**
 * A token of SQL.
 */
export interface Token {
  readonly type: 'word' | 'ident' | 'string' | 'number' | 'punct' | 'op';
  readonly text: string;
}

const OPERATOR_CHARS = new Set('+-*/<>=~!@#%^&|`?');
const PUNCTUATION = new Set('(),;[].');
const UNQUOTED_IDENTIFIER = /^[a-z_][a-z0-9_$]*$/;

function isWordStart(char: string): boolean {
  return /[A-Za-z_]/.test(char) || (char.codePointAt(0) ?? 0) > 0x7f;
}

function isWordPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char) || (char.codePointAt(0) ?? 0) > 0x7f;
}

function readQuoted(
  sql: string,
  start: number,
  quote: string
): [string, number] {
  let text = '';
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (char === quote) {
      if (sql[index + 1] === quote) {
        text += quote;
        index += 2;
        continue;
      }

      return [text, index + 1];
    }

    text += char;
    index += 1;
  }

  return [text, index];
}

const ESCAPES: Readonly<Record<string, string>> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

function readEscapeString(sql: string, start: number): [string, number] {
  let text = '';
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (char === '\\') {
      const escaped = sql[index + 1] ?? '';
      text += ESCAPES[escaped] ?? escaped;
      index += 2;
    } else if (char === "'" && sql[index + 1] === "'") {
      text += "'";
      index += 2;
    } else if (char === "'") {
      return [text, index + 1];
    } else {
      text += char;
      index += 1;
    }
  }

  return [text, index];
}

function skipBlockComment(sql: string, start: number): number {
  let depth = 0;
  let index = start;
  while (index < sql.length) {
    if (sql.startsWith('/*', index)) {
      depth += 1;
      index += 2;
    } else if (sql.startsWith('*/', index)) {
      depth -= 1;
      index += 2;
      if (depth === 0) {
        return index;
      }
    } else {
      index += 1;
    }
  }

  return index;
}

/**
 * Splits SQL into tokens, without whitespace and comments. Keywords and
 * unquoted identifiers are folded to lower case, and so are quoted
 * identifiers that do not need their quotes; string literals are decoded.
 */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1] ?? '';
    if (/\s/.test(char)) {
      index += 1;
    } else if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', index);
      index = end === -1 ? sql.length : end + 1;
    } else if (char === '/' && next === '*') {
      index = skipBlockComment(sql, index);
    } else if (char === "'") {
      const [text, end] = readQuoted(sql, index, "'");
      tokens.push({ type: 'string', text });
      index = end;
    } else if ((char === 'E' || char === 'e') && next === "'") {
      const [text, end] = readEscapeString(sql, index + 1);
      tokens.push({ type: 'string', text });
      index = end;
    } else if (char === '"') {
      const [text, end] = readQuoted(sql, index, '"');
      tokens.push({
        type: UNQUOTED_IDENTIFIER.test(text) ? 'word' : 'ident',
        text,
      });
      index = end;
    } else if (char === '$' && /[0-9]/.test(next)) {
      let end = index + 1;
      while (end < sql.length && /[0-9]/.test(sql[end])) {
        end += 1;
      }

      tokens.push({ type: 'op', text: sql.slice(index, end) });
      index = end;
    } else if (char === '$') {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(
        sql.slice(index)
      )?.[0];
      if (tag === undefined) {
        tokens.push({ type: 'op', text: char });
        index += 1;
      } else {
        const end = sql.indexOf(tag, index + tag.length);
        const stop = end === -1 ? sql.length : end;
        tokens.push({
          type: 'string',
          text: sql.slice(index + tag.length, stop),
        });
        index = end === -1 ? sql.length : end + tag.length;
      }
    } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next))) {
      const number = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(
        sql.slice(index)
      );
      const text = number?.[0] ?? char;
      tokens.push({ type: 'number', text });
      index += text.length;
    } else if (isWordStart(char)) {
      let end = index + 1;
      while (end < sql.length && isWordPart(sql[end])) {
        end += 1;
      }

      tokens.push({
        type: 'word',
        text: sql
          .slice(index, end)
          .replaceAll(/[A-Z]/g, (c) => c.toLowerCase()),
      });
      index = end;
    } else if (char === ':') {
      const text = next === ':' ? '::' : ':';
      tokens.push({ type: 'punct', text });
      index += text.length;
    } else if (PUNCTUATION.has(char)) {
      tokens.push({ type: 'punct', text: char });
      index += 1;
    } else if (OPERATOR_CHARS.has(char)) {
      let end = index + 1;
      while (
        end < sql.length &&
        OPERATOR_CHARS.has(sql[end]) &&
        !sql.startsWith('--', end) &&
        !sql.startsWith('/*', end)
      ) {
        end += 1;
      }

      tokens.push({ type: 'op', text: sql.slice(index, end) });
      index = end;
    } else {
      tokens.push({ type: 'punct', text: char });
      index += 1;
    }
  }

  return tokens;
}

function render(token: Token): string {
  if (token.type === 'ident') {
    return `"${token.text.replaceAll('"', '""')}"`;
  }

  if (token.type === 'string') {
    return `'${token.text.replaceAll("'", "''")}'`;
  }

  return token.text;
}

function renderAll(tokens: ReadonlyArray<Token>): string {
  return tokens.map(render).join(' ');
}

function word(text: string): Token {
  return { type: 'word', text };
}

function punct(text: string): Token {
  return { type: 'punct', text };
}

function isWord(token: Token | undefined, text: string): boolean {
  return token?.type === 'word' && token.text === text;
}

function isPunct(token: Token | undefined, text: string): boolean {
  return token?.type === 'punct' && token.text === text;
}

function isOp(token: Token | undefined, text: string): boolean {
  return token?.type === 'op' && token.text === text;
}

function isWords(
  tokens: ReadonlyArray<Token>,
  index: number,
  words: ReadonlyArray<string>
): boolean {
  return words.every((text, offset) => isWord(tokens[index + offset], text));
}

/**
 * The index of the matching `)` of each `(`.
 */
function matchParens(tokens: ReadonlyArray<Token>): Map<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  for (const [index, token] of tokens.entries()) {
    if (isPunct(token, '(')) {
      open.push(index);
    } else if (isPunct(token, ')')) {
      const start = open.pop();
      if (start !== undefined) {
        pairs.set(start, index);
      }
    }
  }

  return pairs;
}

/**
 * Splits tokens at the separators that are not inside parentheses.
 */
function splitTopLevel(
  tokens: ReadonlyArray<Token>,
  separator: string
): Token[][] {
  const parts: Token[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isPunct(token, '(')) {
      depth += 1;
    } else if (isPunct(token, ')')) {
      depth -= 1;
    }

    if (depth === 0 && isPunct(token, separator)) {
      parts.push([]);
    } else {
      parts.at(-1)?.push(token);
    }
  }

  return parts.filter((part) => part.length > 0);
}

function joinParts(
  parts: ReadonlyArray<ReadonlyArray<Token>>,
  separator: Token
): Token[] {
  return parts.flatMap((part, index) =>
    index === 0 ? [...part] : [separator, ...part]
  );
}

function removeCatalogQualifier(tokens: ReadonlyArray<Token>): Token[] {
  return tokens.filter(
    (token, index) =>
      !(isWord(token, 'pg_catalog') && isPunct(tokens[index + 1], '.')) &&
      !(isPunct(token, '.') && isWord(tokens[index - 1], 'pg_catalog'))
  );
}

function collapseParens(tokens: ReadonlyArray<Token>): Token[] {
  let current = [...tokens];
  let changed = true;
  while (changed) {
    changed = false;
    const pairs = matchParens(current);
    const drop = new Set<number>();
    for (const [open, close] of pairs) {
      const inner = open + 1;
      if (
        !drop.has(open) &&
        isPunct(current[inner], '(') &&
        pairs.get(inner) === close - 1 &&
        splitTopLevel(current.slice(inner + 1, close - 1), ',').length <= 1
      ) {
        drop.add(inner);
        drop.add(close - 1);
        changed = true;
      }
    }

    current = current.filter((_, index) => !drop.has(index));
  }

  return current;
}

function dropWords(
  tokens: ReadonlyArray<Token>,
  words: ReadonlyArray<string>,
  keep: ReadonlyArray<string> = []
): Token[] {
  const result: Token[] = [];
  let index = 0;
  while (index < tokens.length) {
    if (isWords(tokens, index, words)) {
      result.push(...keep.map(word));
      index += words.length;
    } else {
      result.push(tokens[index]);
      index += 1;
    }
  }

  return result;
}

/**
 * `WITH (fillfactor='90')` is `WITH (fillfactor = 90)`.
 */
function unquoteStorageParameters(tokens: ReadonlyArray<Token>): Token[] {
  const pairs = matchParens(tokens);
  const inWith = new Set<number>();
  for (const [open, close] of pairs) {
    if (isWord(tokens[open - 1], 'with')) {
      for (let index = open + 1; index < close; index += 1) {
        inWith.add(index);
      }
    }
  }

  return tokens.map((token, index) =>
    inWith.has(index) &&
    token.type === 'string' &&
    isOp(tokens[index - 1], '=') &&
    /^[\w.+-]+$/.test(token.text)
      ? word(token.text.toLowerCase())
      : token
  );
}

const SEQUENCE_TYPES: Readonly<Record<string, string>> = {
  int2: 'smallint',
  smallint: 'smallint',
  int: 'integer',
  int4: 'integer',
  integer: 'integer',
  int8: 'bigint',
  bigint: 'bigint',
};

const TYPE_BOUNDS: Readonly<Record<string, readonly [bigint, bigint]>> = {
  smallint: [-32_768n, 32_767n],
  integer: [-2_147_483_648n, 2_147_483_647n],
  bigint: [-9_223_372_036_854_775_808n, 9_223_372_036_854_775_807n],
};

const SEQUENCE_KEYWORDS = new Set([
  'as',
  'cache',
  'cycle',
  'increment',
  'maxvalue',
  'minvalue',
  'no',
  'owned',
  'restart',
  'sequence',
  'start',
]);

function readNumber(
  tokens: ReadonlyArray<Token>,
  start: number
): [bigint | undefined, number] {
  let index = start;
  let sign = 1n;
  if (isOp(tokens[index], '-')) {
    sign = -1n;
    index += 1;
  } else if (isOp(tokens[index], '+')) {
    index += 1;
  }

  const token = tokens[index];

  return token?.type === 'number' && /^[0-9]+$/.test(token.text)
    ? [sign * BigInt(token.text), index + 1]
    : [undefined, index];
}

function readUntilKeyword(
  tokens: ReadonlyArray<Token>,
  start: number
): [Token[], number] {
  let index = start;
  while (
    index < tokens.length &&
    !(
      tokens[index].type === 'word' && SEQUENCE_KEYWORDS.has(tokens[index].text)
    )
  ) {
    index += 1;
  }

  return [tokens.slice(start, index), index];
}

function numberToken(value: bigint): Token {
  return { type: 'number', text: value.toString() };
}

/**
 * Sequence options (of `CREATE SEQUENCE` or an identity column) with every
 * default written out, so that options written or left out compare equal.
 */
function canonicalSequenceOptions(
  tokens: ReadonlyArray<Token>,
  defaultType: string
): Token[] {
  let type = defaultType;
  let name: Token[] = [];
  let owner: Token[] = [];
  const unknown: Token[] = [];
  let start: bigint | undefined;
  let increment: bigint | undefined;
  let min: bigint | undefined;
  let max: bigint | undefined;
  let cache: bigint | undefined;
  let cycle = false;
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (isWord(token, 'as')) {
      type = SEQUENCE_TYPES[tokens[index + 1]?.text ?? ''] ?? type;
      index += 2;
    } else if (isWords(tokens, index, ['sequence', 'name'])) {
      [name, index] = readUntilKeyword(tokens, index + 2);
    } else if (isWords(tokens, index, ['owned', 'by'])) {
      [owner, index] = readUntilKeyword(tokens, index + 2);
    } else if (isWord(token, 'start') || isWord(token, 'increment')) {
      const skip =
        isWord(tokens[index + 1], 'with') || isWord(tokens[index + 1], 'by');
      const [value, next] = readNumber(tokens, index + (skip ? 2 : 1));
      if (isWord(token, 'start')) {
        start = value;
      } else {
        increment = value;
      }

      index = next;
    } else if (
      isWords(tokens, index, ['no', 'minvalue']) ||
      isWords(tokens, index, ['no', 'maxvalue']) ||
      isWords(tokens, index, ['no', 'cycle'])
    ) {
      index += 2;
    } else if (isWord(token, 'minvalue')) {
      [min, index] = readNumber(tokens, index + 1);
    } else if (isWord(token, 'maxvalue')) {
      [max, index] = readNumber(tokens, index + 1);
    } else if (isWord(token, 'cache')) {
      [cache, index] = readNumber(tokens, index + 1);
    } else if (isWord(token, 'cycle')) {
      cycle = true;
      index += 1;
    } else {
      unknown.push(token);
      index += 1;
    }
  }

  const [typeMin, typeMax] = TYPE_BOUNDS[type] ?? TYPE_BOUNDS.bigint;
  const step = increment ?? 1n;
  const lower = min ?? (step > 0n ? 1n : typeMin);
  const upper = max ?? (step > 0n ? typeMax : -1n);

  return [
    ...(name.length > 0 ? [word('sequence'), word('name'), ...name] : []),
    word('as'),
    word(type),
    word('start'),
    numberToken(start ?? (step > 0n ? lower : upper)),
    word('increment'),
    numberToken(step),
    word('minvalue'),
    numberToken(lower),
    word('maxvalue'),
    numberToken(upper),
    word('cache'),
    numberToken(cache ?? 1n),
    ...(cycle ? [word('cycle')] : [word('no'), word('cycle')]),
    ...(owner.length > 0 ? [word('owned'), word('by'), ...owner] : []),
    ...unknown,
  ];
}

const TABLE_CONSTRAINT_STARTS = new Set([
  'check',
  'constraint',
  'exclude',
  'foreign',
  'like',
  'primary',
  'unique',
]);

const CLAUSE_STARTS = new Set([
  'check',
  'collate',
  'compression',
  'constraint',
  'default',
  'generated',
  'not',
  'null',
  'primary',
  'references',
  'storage',
  'unique',
]);

const SERIAL_TYPES = new Set([
  'bigserial',
  'serial',
  'serial2',
  'serial4',
  'serial8',
  'smallserial',
]);

function continuesClause(clause: ReadonlyArray<Token>, token: Token): boolean {
  const last = clause.at(-1);

  return (
    (isWord(last, 'not') && isWord(token, 'null')) ||
    (isWord(last, 'by') && isWord(token, 'default')) ||
    (clause.length === 1 && isWord(clause[0], 'default')) ||
    (clause.length === 2 && isWord(clause[0], 'constraint'))
  );
}

function canonicalIdentity(
  clause: ReadonlyArray<Token>,
  columnType: string
): Token[] {
  const identity = clause.findIndex((token) => isWord(token, 'identity'));
  const options = isPunct(clause[identity + 1], '(')
    ? clause.slice(identity + 2, -1)
    : [];

  return [
    ...clause.slice(0, identity + 1),
    punct('('),
    ...canonicalSequenceOptions(
      options,
      SEQUENCE_TYPES[columnType] ?? 'bigint'
    ),
    punct(')'),
  ];
}

function canonicalColumn(element: ReadonlyArray<Token>): Token[] {
  if (
    element.length === 0 ||
    (element[0].type === 'word' && TABLE_CONSTRAINT_STARTS.has(element[0].text))
  ) {
    return [...element];
  }

  let depth = 0;
  let typeEnd = 1;
  while (
    typeEnd < element.length &&
    !(
      depth === 0 &&
      element[typeEnd].type === 'word' &&
      CLAUSE_STARTS.has(element[typeEnd].text)
    )
  ) {
    depth += isPunct(element[typeEnd], '(') ? 1 : 0;
    depth -= isPunct(element[typeEnd], ')') ? 1 : 0;
    typeEnd += 1;
  }

  const type = element.slice(1, typeEnd);
  const typeText = renderAll(type);
  const clauses: Token[][] = [];
  depth = 0;
  for (const token of element.slice(typeEnd)) {
    const current = clauses.at(-1);
    if (
      current === undefined ||
      (depth === 0 &&
        token.type === 'word' &&
        CLAUSE_STARTS.has(token.text) &&
        !continuesClause(current, token))
    ) {
      clauses.push([token]);
    } else {
      current.push(token);
    }

    depth += isPunct(token, '(') ? 1 : 0;
    depth -= isPunct(token, ')') ? 1 : 0;
  }

  const hasIdentity = clauses.some(
    (clause) =>
      isWord(clause[0], 'generated') &&
      clause.some((token) => isWord(token, 'identity'))
  );
  const impliedNotNull = hasIdentity || SERIAL_TYPES.has(typeText);
  const canonicalClauses = clauses
    .filter(
      (clause) =>
        !(clause.length === 1 && isWord(clause[0], 'null')) &&
        !(
          impliedNotNull &&
          clause.length === 2 &&
          isWords(clause, 0, ['not', 'null'])
        )
    )
    .map((clause) =>
      isWord(clause[0], 'generated') &&
      clause.some((token) => isWord(token, 'identity'))
        ? canonicalIdentity(clause, typeText)
        : clause
    )
    .toSorted((a, b) => {
      const left = renderAll(a);
      const right = renderAll(b);

      return left < right ? -1 : left > right ? 1 : 0;
    });

  return [element[0], ...type, ...canonicalClauses.flat()];
}

/**
 * The index of the `(` after `CREATE … <keyword> [IF NOT EXISTS] <name>`,
 * when the statement is such a statement.
 */
function listAfterName(
  tokens: ReadonlyArray<Token>,
  keyword: string,
  modifiers: ReadonlyArray<string>
): number | undefined {
  if (!isWord(tokens[0], 'create')) {
    return undefined;
  }

  let index = 1;
  while (
    tokens[index]?.type === 'word' &&
    modifiers.includes(tokens[index].text)
  ) {
    index += 1;
  }

  if (!isWord(tokens[index], keyword)) {
    return undefined;
  }

  index += 1;
  if (isWords(tokens, index, ['if', 'not', 'exists'])) {
    index += 3;
  }

  index += isPunct(tokens[index + 1], '.') ? 3 : 1;

  return index;
}

function canonicalCreateTable(tokens: ReadonlyArray<Token>): Token[] {
  const open = listAfterName(tokens, 'table', [
    'global',
    'local',
    'temp',
    'temporary',
    'unlogged',
  ]);
  const close = open === undefined ? undefined : matchParens(tokens).get(open);
  if (open === undefined || close === undefined) {
    return [...tokens];
  }

  return [
    ...tokens.slice(0, open + 1),
    ...joinParts(
      splitTopLevel(tokens.slice(open + 1, close), ',').map(canonicalColumn),
      punct(',')
    ),
    ...tokens.slice(close),
  ];
}

function canonicalCreateSequence(tokens: ReadonlyArray<Token>): Token[] {
  const options = listAfterName(tokens, 'sequence', [
    'temp',
    'temporary',
    'unlogged',
  ]);

  return options === undefined
    ? [...tokens]
    : [
        ...tokens.slice(0, options),
        ...canonicalSequenceOptions(tokens.slice(options), 'bigint'),
      ];
}

function canonicalRoutineArguments(tokens: ReadonlyArray<Token>): Token[] {
  const modifiers = ['or', 'replace'];
  const open =
    listAfterName(tokens, 'function', modifiers) ??
    listAfterName(tokens, 'procedure', modifiers);
  const close = open === undefined ? undefined : matchParens(tokens).get(open);
  if (open === undefined || close === undefined) {
    return [...tokens];
  }

  const parameters = splitTopLevel(tokens.slice(open + 1, close), ',').map(
    (parameter) =>
      isWord(parameter[0], 'in') && parameter.length > 1
        ? parameter.slice(1)
        : parameter
  );

  return [
    ...tokens.slice(0, open + 1),
    ...joinParts(parameters, punct(',')),
    ...tokens.slice(close),
  ];
}

const DEFAULT_OPTIONS = new Set([
  'deterministic = true',
  'finalfunc_modify = read_only',
  'mfinalfunc_modify = read_only',
  'msspace = 0',
  'parallel = unsafe',
  'provider = libc',
  'sspace = 0',
]);

const WORD_VALUED_OPTIONS = new Set([
  'deterministic',
  'finalfunc_modify',
  'mfinalfunc_modify',
  'parallel',
  'provider',
]);

function canonicalOption(
  option: ReadonlyArray<Token>,
  operator: boolean
): string {
  const key = option[0]?.text ?? '';
  const name = operator && key === 'procedure' ? 'function' : key;
  if (!isOp(option[1], '=')) {
    return renderAll([word(name), ...option.slice(1)]);
  }

  const value = option
    .slice(2)
    .map((token) =>
      token.type === 'string' && WORD_VALUED_OPTIONS.has(name)
        ? word(token.text.toLowerCase())
        : token
    );

  return `${name} = ${renderAll(value)}`;
}

/**
 * The options of `CREATE AGGREGATE | COLLATION | OPERATOR` and `CREATE TYPE
 * … AS RANGE`, sorted, without the ones that have their default value.
 */
function canonicalOptionList(tokens: ReadonlyArray<Token>): Token[] {
  const optionList =
    isWord(tokens[0], 'create') &&
    (isWord(tokens[1], 'aggregate') ||
      isWord(tokens[1], 'collation') ||
      isWord(tokens[1], 'operator') ||
      (isWord(tokens[1], 'type') &&
        tokens.some(
          (token, index) =>
            isWord(token, 'as') && isWord(tokens[index + 1], 'range')
        )));
  const close = tokens.length - 1;
  const open = [...matchParens(tokens)].find(([, end]) => end === close)?.[0];
  if (!optionList || open === undefined) {
    return [...tokens];
  }

  const options = splitTopLevel(tokens.slice(open + 1, close), ',')
    .map((option) => canonicalOption(option, isWord(tokens[1], 'operator')))
    .filter((option) => !DEFAULT_OPTIONS.has(option))
    .toSorted()
    .map(word);

  return [
    ...tokens.slice(0, open + 1),
    ...joinParts(
      options.map((option) => [option]),
      punct(',')
    ),
    punct(')'),
  ];
}

function canonicalPolicy(tokens: ReadonlyArray<Token>): Token[] {
  if (!isWords(tokens, 0, ['create', 'policy'])) {
    return [...tokens];
  }

  return dropWords(tokens, ['for', 'all']).filter(
    (token, index, all) =>
      !(
        isWord(token, 'to') &&
        isWord(all[index + 1], 'public') &&
        !isPunct(all[index + 2], ',')
      ) &&
      !(
        isWord(token, 'public') &&
        isWord(all[index - 1], 'to') &&
        !isPunct(all[index + 1], ',')
      )
  );
}

function canonicalStatement(tokens: ReadonlyArray<Token>): string {
  let current = removeCatalogQualifier(tokens);
  current = collapseParens(current);
  current = unquoteStorageParameters(current);
  current = dropWords(current, ['using', 'btree']);
  current = dropWords(current, ['alter', 'table', 'only'], ['alter', 'table']);
  current = dropWords(
    current,
    ['execute', 'procedure'],
    ['execute', 'function']
  );
  current = dropWords(current, ['asc']);
  current = dropWords(current, ['parallel', 'unsafe']);
  current = dropWords(current, ['with', 'data']);
  current = canonicalPolicy(current);
  current = canonicalRoutineArguments(current);
  current = canonicalCreateTable(current);
  current = canonicalCreateSequence(current);
  current = canonicalOptionList(current);

  return renderAll(current);
}

/**
 * The canonical form of each statement of `sql` (see the top of this file).
 */
export function canonicalStatements(sql: string): string[] {
  return splitTopLevel(tokenize(sql), ';').map(canonicalStatement);
}

/**
 * The canonical form of each statement of the SQL steps of a
 * `MigrationBuilder`.
 */
export function canonicalSteps(steps: ReadonlyArray<string>): string[] {
  return canonicalStatements(steps.join('\n'));
}

/**
 * The first statement, then the others sorted: for a statement followed by
 * statements whose order does not matter (e.g. the comments of a table).
 */
export function firstThenSorted(statements: ReadonlyArray<string>): string[] {
  return [...statements.slice(0, 1), ...statements.slice(1).toSorted()];
}
