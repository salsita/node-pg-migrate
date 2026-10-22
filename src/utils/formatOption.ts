import { escapeValue } from './escapeValue';
import { quote } from './quote';

/**
 * Quote reloption names for views and materialized views: fold ASCII case like
 * unquoted SQL and quote each dot-separated part.
 */
export function quoteOptionName(key: string): string {
  return key
    .replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase())
    .split('.')
    .map(quote)
    .join('.');
}

export function formatOption(
  quotedName: string,
  value: string | number | boolean | null
): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(
      `Invalid value for option ${quotedName}: ${value}. Expected a finite number.`
    );
  }

  return `${quotedName} = ${escapeValue(value)}`;
}
