import { quote } from '../../utils/quote';
import type { QualifiedName } from '../types';
import {
  closingQuote,
  codeAt,
  foldIdentifier,
  isIdentifierStart,
  skipIdentifier,
} from './lexer';

const DOUBLE_QUOTE = 0x22;
const DOT = 0x2e;

/**
 * One identifier: the name PostgreSQL stores and the offset right after it.
 */
interface ParsedIdentifier {
  readonly name: string;
  readonly end: number;
}

/**
 * Reads the double-quoted identifier whose opening quote is at `from`; a
 * doubled quote inside stands for a quote. An unterminated or empty one is
 * not an identifier.
 */
function readQuotedIdentifier(
  text: string,
  from: number
): ParsedIdentifier | undefined {
  const close = closingQuote(text, from);
  if (close <= from + 1) {
    return undefined;
  }

  return {
    name: text.slice(from + 1, close).replaceAll('""', '"'),
    end: close + 1,
  };
}

/**
 * Reads the unquoted (folded to lower case) or double-quoted identifier that
 * starts at `from`.
 */
function readIdentifier(
  text: string,
  from: number
): ParsedIdentifier | undefined {
  const code = codeAt(text, from);
  if (code === DOUBLE_QUOTE) {
    return readQuotedIdentifier(text, from);
  }

  if (!isIdentifierStart(code)) {
    return undefined;
  }

  const end = skipIdentifier(text, from + 1);

  return { name: foldIdentifier(text.slice(from, end)), end };
}

/**
 * Parses a name that is optionally qualified with its schema (`name` or
 * `schema.name`, each part an unquoted or a double-quoted identifier) and
 * starts at `from` in `text`.
 *
 * Unquoted identifiers are folded to lower case like PostgreSQL does (only
 * the ASCII letters change); quoted ones keep their case, with doubled
 * quotes undoubled. A dot that no identifier follows is not part of the
 * name.
 *
 * @param text The text to parse, e.g. a statement of a dump.
 * @param from The offset in `text` where the name starts.
 * @returns The name as PostgreSQL stores it (see {@link QualifiedName}) and
 * `end`, the offset right after it in `text`; `undefined` when no identifier
 * starts at `from`.
 */
export function parseQualifiedName(
  text: string,
  from: number
): (QualifiedName & { readonly end: number }) | undefined {
  const first = readIdentifier(text, from);
  if (first === undefined) {
    return undefined;
  }

  const second =
    codeAt(text, first.end) === DOT
      ? readIdentifier(text, first.end + 1)
      : undefined;

  return second === undefined
    ? { name: first.name, end: first.end }
    : { schema: first.name, name: second.name, end: second.end };
}

/**
 * Whether an identifier names the configured object, following PostgreSQL's
 * identifier rules: unquoted identifiers fold to lower case, quoted ones are
 * exact.
 *
 * @param parsed The identifier as found in SQL, e.g. `PgMigrations` (the
 * same as `pgmigrations`) or `"PgMigrations"`.
 * @param configured The configured name, e.g. the migrations table.
 */
export function identEquals(parsed: string, configured: string): boolean {
  if (codeAt(parsed, 0) !== DOUBLE_QUOTE) {
    return foldIdentifier(parsed) === configured;
  }

  const identifier = readQuotedIdentifier(parsed, 0);

  return identifier?.end === parsed.length && identifier.name === configured;
}

/**
 * Turns a name into a pg_dump pattern that matches exactly that object:
 * `"schema"."name"` with every `"` in the names doubled.
 *
 * @param name The name of the object.
 */
export function toPgDumpPattern(name: QualifiedName): string {
  return name.schema === undefined
    ? quote(name.name)
    : `${quote(name.schema)}.${quote(name.name)}`;
}
