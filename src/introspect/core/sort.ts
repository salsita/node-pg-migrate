/**
 * Compares two strings by their UTF-16 code units, like `<` does, and unlike
 * `localeCompare()`: the order is the same on every machine.
 *
 * @param a A string.
 * @param b Another string.
 * @returns A negative number when `a` comes first, a positive one when `b`
 * does, 0 when they are equal.
 */
export function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}

/**
 * Writes an OID so that OIDs sort as numbers when compared as text: OIDs are
 * unsigned 32-bit integers, so at most 10 digits.
 *
 * @param oid The OID.
 * @returns The OID with leading zeros, 10 digits long.
 */
export function oidKey(oid: number): string {
  return String(oid).padStart(10, '0');
}

/**
 * Compares two sort keys of the same length, part by part (see
 * {@link compareText}).
 *
 * @param a A key.
 * @param b Another key.
 * @returns The order of the first parts that differ, 0 when none do.
 */
function compareKeys(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): number {
  for (const [index, part] of a.entries()) {
    const order = compareText(part, b[index]);
    if (order !== 0) {
      return order;
    }
  }

  return 0;
}

/**
 * Sorts items by a key made of strings, computing each item's key once.
 *
 * @param items The items.
 * @param key The sort key of an item: strings compared one after the other.
 * Every key must have the same length.
 * @returns A sorted copy of `items`.
 */
export function sortByKey<T>(
  items: ReadonlyArray<T>,
  key: (item: T) => ReadonlyArray<string>
): T[] {
  return items
    .map((item) => ({ item, key: key(item) }))
    .toSorted((a, b) => compareKeys(a.key, b.key))
    .map(({ item }) => item);
}
