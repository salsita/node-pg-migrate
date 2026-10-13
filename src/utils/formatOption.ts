import { escapeValue } from './escapeValue';
import { quote } from './quote';

/** Quote view option names while preserving unquoted SQL case and namespaces. */
export function quoteOptionName(key: string): string {
  return key
    .replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase())
    .split('.')
    .map(quote)
    .join('.');
}

export function formatOption(
  key: string,
  value: string | number | boolean | null,
  quoteName: (name: string) => string = quote
): string {
  return `${quoteName(key)} = ${escapeValue(value)}`;
}
