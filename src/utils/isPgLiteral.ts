import PgLiteral from '../operations/PgLiteral';

export function isPgLiteral(val: unknown): val is PgLiteral {
  return (
    val instanceof PgLiteral ||
    (typeof val === 'object' &&
      val !== null &&
      'literal' in val &&
      (val as { literal: unknown }).literal === true)
  );
}
