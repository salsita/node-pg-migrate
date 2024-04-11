import type { PublicPart } from '../operations/generalTypes';

// This is used to create unescaped strings
// exposed in the migrations via pgm.func
export class PgLiteral {
  static create(str: string): PgLiteral {
    return new PgLiteral(str);
  }

  public readonly literal = true;

  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }
}

export type PgLiteralValue = PublicPart<PgLiteral>;

export function isPgLiteral(val: unknown): val is PgLiteral {
  return (
    val instanceof PgLiteral ||
    (typeof val === 'object' &&
      val !== null &&
      'literal' in val &&
      (val as { literal: unknown }).literal === true)
  );
}
