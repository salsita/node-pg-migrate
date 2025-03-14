import { escapeValue } from '.';
import type { Name, Value } from '../operations/generalTypes';

export type Literal = (v: Name) => string;

export function createTransformer(
  literal: Literal
): (statement: string, mapping?: { [key: string]: Name | Value }) => string {
  return (statement, mapping = {}) =>
    Object.keys(mapping).reduce((str, param) => {
      const val = mapping?.[param];
      return str.replace(
        new RegExp(`{${param}}`, 'g'),
        val === undefined
          ? ''
          : typeof val === 'string' ||
              (typeof val === 'object' && val !== null && 'name' in val)
            ? literal(val)
            : String(escapeValue(val)).replace(/\$/g, '$$$$')
      );
    }, statement);
}
