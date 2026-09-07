import { isPgLiteral, stringIdGenerator } from '.';
import type { Value } from '../operations/generalTypes';

const ARRAY_KEYWORD = 'ARRAY';

export function escapeValue(val: Value): string | number {
  if (val === null) {
    return 'NULL';
  }

  if (typeof val === 'boolean') {
    return val.toString();
  }

  if (typeof val === 'string') {
    let dollars: string;
    const ids = stringIdGenerator();
    let index: string;

    do {
      index = ids.next().value;
      dollars = `$pg${index}$`;
    } while (val.includes(dollars));

    return `${dollars}${val}${dollars}`;
  }

  if (typeof val === 'number') {
    return val;
  }

  if (Array.isArray(val)) {
    // A nested array escapes to its own `ARRAY[…]` constructor, but Postgres
    // expects the keyword only on the outermost one: `ARRAY[[1],[2]]` rather
    // than `ARRAY[ARRAY[1],ARRAY[2]]`. Strip the keyword from the nested
    // element itself — stripping it from the joined string would also delete
    // `ARRAY` wherever it occurs inside escaped string values.
    const elements = val.map((element) =>
      Array.isArray(element)
        ? String(escapeValue(element)).slice(ARRAY_KEYWORD.length)
        : escapeValue(element)
    );

    return `${ARRAY_KEYWORD}[${elements.join(',')}]`;
  }

  if (isPgLiteral(val)) {
    return val.value;
  }

  return '';
}
