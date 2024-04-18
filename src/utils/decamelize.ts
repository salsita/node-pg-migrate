// Simplified copy of https://github.com/sindresorhus/decamelize/blob/5deb8c5b88c3dbc93ef0d68faa0fc45cf98cad9d/index.js
const REPLACEMENT = '$1_$2';

/**
 * Convert a string into a decamelize lowercased one.
 *
 * @example
 * unicornsAndRainbows → unicorns_and_rainbows
 * myURLString → my_url_string
 *
 * @param text The string to decamelize.
 * @returns The decamelized string.
 */
export function decamelize(text: string): string {
  // Checking the second character is done later on. Therefore process shorter strings here.
  if (text.length < 2) {
    return text.toLowerCase();
  }

  // Split lowercase sequences followed by uppercase character.
  // `dataForUSACounties` → `data_For_USACounties`
  // `myURLstring → `my_URLstring`
  const decamelized = text.replace(
    /([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu,
    REPLACEMENT
  );

  // Split multiple uppercase characters followed by one or more lowercase characters.
  // `my_URLstring` → `my_ur_lstring`
  return decamelized
    .replace(
      /(\p{Uppercase_Letter})(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      REPLACEMENT
    )
    .toLowerCase();
}
