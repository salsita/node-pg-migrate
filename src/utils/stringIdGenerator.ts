/**
 * Generates an infinite sequence of unique string identifiers using the given characters.
 *
 * Starts with shorter combinations and increases length as needed.
 *
 * @param chars The set of characters to be used for generating identifiers. Defaults to `'abcdefghijklmnopqrstuvwxyz'`.
 *
 * @returns A generator that yields unique string identifiers.
 *
 * @throws If `chars` is an empty string, as at least one character is required to generate identifiers.
 *
 * @see https://stackoverflow.com/a/12504061/4790644
 */
export function* stringIdGenerator(
  chars: string = 'abcdefghijklmnopqrstuvwxyz'
): Generator<string, string> {
  if (!chars || chars.length === 0) {
    throw new Error('chars must be a non-empty string');
  }

  const ids: number[] = [0];
  while (true) {
    yield ids.map((id) => chars[id]).join('');
    for (let i = ids.length - 1; i >= 0; i -= 1) {
      ids[i] += 1;
      if (ids[i] < chars.length) {
        break;
      }

      ids[i] = 0;
      if (i === 0) {
        ids.unshift(0);
      }
    }
  }
}
