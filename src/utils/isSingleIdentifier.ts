// A single ordinary or double-quoted PostgreSQL identifier, with optional SQL
// whitespace. Dots and doubled quotes inside a quoted identifier are content.
// Raw SQL expressions, qualifications and U& escape syntax require explicit SQL.
const SINGLE_IDENTIFIER =
  /^[ \t\r\n\f\v]*(?:[A-Za-z_\u0080-\u{10FFFF}][A-Za-z0-9_$\u0080-\u{10FFFF}]*|"(?:[^"]|"")+")[ \t\r\n\f\v]*$/u;

export function isSingleIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.includes('\0') &&
    SINGLE_IDENTIFIER.test(value)
  );
}
