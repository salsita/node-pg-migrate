import type { Logger } from '../logger';
import { getNumericPrefix } from './fileNameUtils';

export function localeCompareStringsNumerically(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    usage: 'sort',
    numeric: true,
    sensitivity: 'variant',
    ignorePunctuation: true,
  });
}

/**
 * Compares two file names by their numeric prefix.
 * 17 digit numbers are interpreted as UTC date and converted to the number
 * representation of that date. 1...4 digit numbers are interpreted as index
 * based naming scheme.
 *
 * @param a the first file name to compare
 * @param b the second file name to compare
 * @param logger the logger to use for logging
 * @returns a negative value if `a` is less than `b`, 0 if they are equal, and a positive value if `a` is greater than `b`
 */
export function compareFileNamesByTimestamp(
  a: string,
  b: string,
  logger?: Logger
): number {
  const aTimestamp = getNumericPrefix(a, logger);
  const bTimestamp = getNumericPrefix(b, logger);

  return aTimestamp - bTimestamp;
}

/**
 * Compares two file names by their numeric prefix and locale.
 *
 * @param a the first file name to compare
 * @param b the second file name to compare
 * @param logger the logger to use for logging
 * @returns a negative value if `a` is less than `b`, 0 if they are equal, and a positive value if `a` is greater than `b`
 */
export function compareMigrationFileNames(
  a: string,
  b: string,
  logger?: Logger
): number {
  return (
    compareFileNamesByTimestamp(a, b, logger) ||
    localeCompareStringsNumerically(a, b)
  );
}
