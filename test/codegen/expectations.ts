import { expect } from 'vitest';
import type { EmitResult } from './run';
import { canonicalStatements, canonicalSteps, firstThenSorted } from './sql';

interface HasSteps {
  readonly steps: ReadonlyArray<string>;
}

/**
 * The SQL of the steps is the expected DDL (see `sql.ts` for what "is"
 * tolerates).
 */
export function expectSql(result: HasSteps, expected: string): void {
  expect(canonicalSteps(result.steps)).toStrictEqual(
    canonicalStatements(expected)
  );
}

/**
 * The first statement is the expected first statement, and the others are
 * the expected others in any order (e.g. a table and its comments).
 */
export function expectSqlThenAnyOrder(
  result: HasSteps,
  expected: string
): void {
  expect(firstThenSorted(canonicalSteps(result.steps))).toStrictEqual(
    firstThenSorted(canonicalStatements(expected))
  );
}

/**
 * The SQL of the steps is one of the expected DDLs, for what the contract
 * leaves open.
 */
export function expectSqlOneOf(
  result: HasSteps,
  alternatives: ReadonlyArray<string>
): void {
  expect(alternatives.map((sql) => canonicalStatements(sql))).toContainEqual(
    canonicalSteps(result.steps)
  );
}

/**
 * The step only uses `pgm` operations.
 */
export function expectCode(result: EmitResult): void {
  expect(result.emitted.kind).toBe('code');
}

/**
 * The step is a fallback for exactly these reasons, given in the order the
 * emitter's JSDoc lists them (several are joined with `', '` in that order,
 * CONTRACT-TS.md §9).
 */
export function expectFallback(
  result: EmitResult,
  ...reasons: ReadonlyArray<string>
): void {
  expect(result.emitted).toStrictEqual({
    kind: 'fallback',
    code: result.emitted.code,
    reason: reasons.join(', '),
  });
}
