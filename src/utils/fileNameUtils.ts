import { extname } from 'node:path';
import type { Logger } from '../logger';

/**
 * Extracts the file extension from a file name.
 *
 * @param fileName file name to extract the extension from
 * @returns the file extension
 */
export function getSuffixFromFileName(fileName: string): string {
  return extname(fileName).slice(1);
}

/**
 * Extracts contiguous numeric value from the start of `filename` up to the
 * first non-numeric character.
 * 17 digit numbers are interpreted as UTC date and converted to the number
 * representation of that date. 1...4 digit numbers are interpreted as index
 * based naming scheme.
 *
 * @param filename filename to extract the prefix from
 * @param logger Redirect messages to this logger object, rather than `console`.
 * @returns numeric value of the filename prefix (everything before the first
 * non-numeric character).
 */
export function getNumericPrefix(
  filename: string,
  logger: Logger = console
): number {
  const prefix = (/^(\d+)/.exec(filename) || '')[0];
  const value = Number(prefix);

  if (!/^\d+$/.test(prefix) || Number.isNaN(value)) {
    logger.error(`Cannot determine numeric prefix for "${filename}"`);
    throw new Error(`Cannot determine numeric prefix for "${filename}"`);
  }

  // Special case for UTC timestamp
  if (prefix.length === 17) {
    // utc: 20200513070724505
    const year = prefix.slice(0, 4);
    const month = prefix.slice(4, 6);
    const date = prefix.slice(6, 8);
    const hours = prefix.slice(8, 10);
    const minutes = prefix.slice(10, 12);
    const seconds = prefix.slice(12, 14);
    const ms = prefix.slice(14, 17);
    return new Date(
      `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.${ms}Z`
    ).valueOf();
  }

  return value;
}
