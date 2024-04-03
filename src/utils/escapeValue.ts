import { isPgLiteral, StringIdGenerator } from '.';
import type { Value } from '../operations/generalTypes';

export function escapeValue(val: Value): string | number {
  if (val === null) {
    return 'NULL';
  }

  if (typeof val === 'boolean') {
    return val.toString();
  }

  if (typeof val === 'string') {
    let dollars: string;
    const ids = new StringIdGenerator();
    let index: string;

    do {
      index = ids.next();
      dollars = `$pg${index}$`;
    } while (val.includes(dollars));

    return `${dollars}${val}${dollars}`;
  }

  if (typeof val === 'number') {
    return val;
  }

  if (Array.isArray(val)) {
    const arrayStr = val.map(escapeValue).join(',').replace(/ARRAY/g, '');
    return `ARRAY[${arrayStr}]`;
  }

  if (isPgLiteral(val)) {
    return val.value;
  }

  return '';
}
