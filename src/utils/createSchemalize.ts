import decamelize from 'decamelize';
import { identity, quote } from '.';
import type { Name } from '../operations/generalTypes';

export function createSchemalize(
  shouldDecamelize: boolean,
  shouldQuote: boolean
): (v: Name) => string {
  const transform = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity,
  ].reduce((acc, fn) => (fn === identity ? acc : (x: string) => acc(fn(x))));

  return (v) => {
    if (typeof v === 'object') {
      const { schema, name } = v;
      return (schema ? `${transform(schema)}.` : '') + transform(name);
    }

    return transform(v);
  };
}
