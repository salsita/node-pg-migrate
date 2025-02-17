import type { Name } from '../operations/generalTypes';
import { decamelize } from './decamelize';
import { identity } from './identity';
import { quote } from './quote';

export interface SchemalizeOptions {
  readonly shouldDecamelize: boolean;
  readonly shouldQuote: boolean;
}

export function createSchemalize(
  options: SchemalizeOptions
): (value: Name) => string {
  const { shouldDecamelize, shouldQuote } = options;

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
