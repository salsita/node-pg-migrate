/**
 * If the given value is an array, a copy of it is returned. Otherwise, the value is wrapped in an array.
 *
 * @param item The item to eventually wrap in an array.
 */
export function toArray<T>(item: T | ReadonlyArray<T>): T[] {
  // `Array.isArray` cannot narrow `T | ReadonlyArray<T>` while `T` is generic,
  // because `T` itself could be an array type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Array.isArray(item) ? [...item] : [item as T];
}
