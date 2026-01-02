import type { Name } from '../operations/generalTypes';
import { decamelize } from './decamelize';
import { identity } from './identity';
import { isPgLiteral } from './PgLiteral';
import { quote } from './quote';

export interface SchemalizeOptions {
  readonly shouldDecamelize: boolean;
  readonly shouldQuote: boolean;
}

const OPERATOR_PATTERN = /(->|::)/;
const LOGICAL_PATTERN = /[=<>!]+/;
const FUNCTION_CALL_PATTERN = /^[\w.]+\(/;
const ARITHMETIC_PATTERN = /\s+[+*/-]\s+/;
const ALPHANUMERIC_PATTERN = /[a-zA-Z0-9]/;

function isExpression(value: string): boolean {
  if (OPERATOR_PATTERN.test(value)) {
    return true;
  }

  if (FUNCTION_CALL_PATTERN.test(value)) {
    return true;
  }

  if (ARITHMETIC_PATTERN.test(value)) {
    return true;
  }

  // Ensure we only treat strings with logical operators as expressions when they also contain alphanumeric characters.
  // This avoids false positives from standalone operators like ">" or "!=".
  return LOGICAL_PATTERN.test(value) && ALPHANUMERIC_PATTERN.test(value);
}

export function createSchemalize(
  options: SchemalizeOptions
): (value: Name) => string {
  const { shouldDecamelize, shouldQuote } = options;

  const transform = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity,
  ].reduce((acc, fn) => (fn === identity ? acc : (str) => acc(fn(str))));

  return (value: Name) => {
    if (isPgLiteral(value)) {
      return value.toString();
    }

    if (typeof value === 'object' && value !== null) {
      const { schema, name } = value;

      if (name !== undefined) {
        return (schema ? `${transform(schema)}.` : '') + transform(name);
      }
    }

    // Wrap raw SQL expressions in parentheses only when not quoting;
    // quoted values are treated as identifiers/literals and must stay unchanged.
    if (!shouldQuote && typeof value === 'string' && isExpression(value)) {
      return `(${value})`;
    }

    if (typeof value === 'string') {
      return transform(value);
    }

    return transform(String(value));
  };
}
