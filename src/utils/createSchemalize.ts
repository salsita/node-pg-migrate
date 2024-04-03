import decamelize from 'decamelize';
import { identity, quote } from '.';
import type { Name } from '../operations/generalTypes';

export function createSchemalize(
  shouldDecamelize: boolean,
  shouldQuote: boolean
): (value: Name) => string {
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
