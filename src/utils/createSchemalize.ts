import decamelize from 'decamelize';
import { identity, quote } from '.';
import type { Name } from '../operations/generalTypes';

/** @deprecated Use createSchemalize(options) instead. */
export function createSchemalize(
  shouldDecamelize: boolean,
  shouldQuote: boolean
): (value: Name) => string;
export function createSchemalize(options: {
  shouldDecamelize: boolean;
  shouldQuote: boolean;
}): (value: Name) => string;
export function createSchemalize(
  options: boolean | { shouldDecamelize: boolean; shouldQuote: boolean },
  _legacyShouldQuote?: boolean
): (value: Name) => string {
  const { shouldDecamelize, shouldQuote } =
    typeof options === 'boolean'
      ? {
          shouldDecamelize: options,
          shouldQuote: _legacyShouldQuote,
        }
      : options;

  if (typeof options === 'boolean') {
    console.warn(
      'createSchemalize(shouldDecamelize, shouldQuote) is deprecated. Use createSchemalize({ shouldDecamelize, shouldQuote }) instead.'
    );
  }

  const transform = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity,
  ].reduce((acc, fn) => (fn === identity ? acc : (str) => acc(fn(str))));

  return (value) => {
    if (typeof value === 'object') {
      const { schema, name } = value;
      return (schema ? `${transform(schema)}.` : '') + transform(name);
    }

    return transform(value);
  };
}
