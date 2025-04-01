import type { PublicPart } from '../operations/generalTypes';

/**
 * Represents a string that should not be escaped when used in a query.
 *
 * This will be used in `pgm.func` to create unescaped strings.
 */
export class PgLiteral {
  /**
   * Creates a new `PgLiteral` instance.
   *
   * @param str The string value.
   * @returns The new `PgLiteral` instance.
   */
  static create(str: string): PgLiteral {
    return new PgLiteral(str);
  }

  /**
   * Indicates that this object is a `PgLiteral`.
   */
  public readonly literal = true;

  /**
   * Value of the literal.
   */
  public readonly value: string;

  /**
   * Creates a new `PgLiteral` instance.
   *
   * @param value The string value.
   */
  constructor(value: string) {
    this.value = value;
  }

  /**
   * Returns the string value.
   *
   * @returns The string value.
   */
  toString(): string {
    return this.value;
  }
}

export type PgLiteralValue = PublicPart<PgLiteral>;

/**
 * Checks if the given value is a `PgLiteral`.
 *
 * @param val The value to check.
 * @returns `true` if the value is a `PgLiteral`, or `false` otherwise.
 */
export function isPgLiteral(val: unknown): val is PgLiteral {
  return (
    val instanceof PgLiteral ||
    (typeof val === 'object' &&
      val !== null &&
      'literal' in val &&
      (val as { literal: unknown }).literal === true)
  );
}
