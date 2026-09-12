// Helpers that several emitters share.

/**
 * Whether an object literal with these keys, in this order, keeps them in
 * this order. JavaScript puts integer-like keys (`'0'`, `'42'`) first, in
 * numeric order, so `createTable` and `createType`, which read their columns
 * with `Object.keys()`, would reorder columns named that way.
 *
 * @param names The keys, in the wanted order.
 */
export function keepsKeyOrder(names: ReadonlyArray<string>): boolean {
  const keys = Object.keys(
    Object.fromEntries(names.map((name) => [name, true]))
  );

  return (
    keys.length === names.length &&
    keys.every((key, index) => key === names[index])
  );
}

/**
 * Whether a text has a line break, which the operations that write each
 * column or constraint on one line (`createTable`, `addConstraint`) turn
 * into a space, even inside a string constant.
 *
 * @param text The text.
 */
export function hasLineBreak(text: string): boolean {
  return text.includes('\n') || text.includes('\r');
}
