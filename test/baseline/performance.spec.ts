import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  estimateRelations,
  requiredMaxLocksPerTransaction,
} from '../../src/baseline/core/locks';
import { sanitizeDump } from '../../src/baseline/core/sanitize';
import { scanTopLevel } from '../../src/baseline/core/scan';
import { generateDumpLike } from '../fixtures/generate';
import { DEFAULT_SANITIZE_OPTIONS } from './helpers';

/**
 * The generous budget of each pathological input.
 */
const BUDGET_MS = 5000;

/**
 * Timing tests retry, since a busy machine can make one run slow.
 */
const PERFORMANCE = { retry: 2, timeout: 120_000 };

/**
 * Runs a function and measures how long it took.
 */
function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();

  return { value, ms: performance.now() - start };
}

/**
 * The median duration of several runs of a function.
 */
function medianMs(runs: number, fn: () => unknown): number {
  const durations = Array.from({ length: runs }, () => timed(fn).ms).toSorted(
    (a, b) => a - b
  );

  return durations[Math.floor(runs / 2)] ?? Number.POSITIVE_INFINITY;
}

/**
 * Inputs that make naive scanners slow (backtracking, rescanning, recursion).
 */
const PATHOLOGICAL: ReadonlyArray<{
  readonly name: string;
  readonly sql: () => string;
  readonly statements: number;
}> = [
  {
    name: '1 MB of $$…$$ pairs',
    sql: () => `SELECT ${'$$a;$$ || '.repeat(120_000)}$$z$$;\n`,
    statements: 1,
  },
  {
    name: '10k nested /* */ comments',
    sql: () =>
      `${'/* '.repeat(10_000)}; ${'*/ '.repeat(10_000)}\nSELECT ${'/*'.repeat(10_000)} ; ${'*/'.repeat(10_000)} 1;\n`,
    statements: 1,
  },
  {
    name: 'a 5 MB single-line string',
    sql: () => `SELECT '${"x;'' ".repeat(1_000_000)}';\n`,
    statements: 1,
  },
  {
    name: "2 MB of E'…' backslash escapes",
    sql: () => `SELECT E'${'\\\\'.repeat(1_000_000)}';\n`,
    statements: 1,
  },
  {
    name: '100k statements',
    sql: () => 'SELECT 1;'.repeat(100_000),
    statements: 100_000,
  },
  {
    name: '100k bare semicolons',
    sql: () => ';'.repeat(100_000),
    statements: 100_000,
  },
];

describe('performance', () => {
  it.each(PATHOLOGICAL)(
    'performance: scanTopLevel slices $name within 5 s',
    PERFORMANCE,
    ({ sql, statements }) => {
      const input = sql();
      const { value: segments, ms } = timed(() => scanTopLevel(input));

      expect(ms).toBeLessThan(BUDGET_MS);
      expect(segments.map((segment) => segment.text).join('')).toBe(input);
      expect(
        segments.filter((segment) => segment.kind === 'statement')
      ).toHaveLength(statements);
    }
  );

  it.each(PATHOLOGICAL)(
    'performance: sanitizeDump cleans up $name within 5 s',
    PERFORMANCE,
    ({ sql }) => {
      const input = sql();
      const { value, ms } = timed(() =>
        sanitizeDump(input, DEFAULT_SANITIZE_OPTIONS)
      );

      expect(ms).toBeLessThan(BUDGET_MS);
      expect(value.sql.endsWith('\n')).toBe(true);
    }
  );

  it.each([
    { name: 'scanTopLevel', run: (sql: string): unknown => scanTopLevel(sql) },
    {
      name: 'sanitizeDump',
      run: (sql: string): unknown =>
        sanitizeDump(sql, DEFAULT_SANITIZE_OPTIONS),
    },
  ])(
    'performance: $name scales linearly with the size of a dump',
    PERFORMANCE,
    ({ run }) => {
      const small = generateDumpLike(500);
      const large = generateDumpLike(2000);

      expect(small.length).toBeGreaterThan(800_000);
      expect(large.length / small.length).toBeGreaterThan(3.5);
      run(small);
      run(large);

      const ratio =
        medianMs(5, () => run(large)) / medianMs(5, () => run(small));

      expect(ratio).toBeLessThan(8);
    }
  );

  it(
    'performance: sanitizeDump cleans up a 5,000-table dump within 5 s, which needs max_locks_per_transaction = 512',
    PERFORMANCE,
    () => {
      const dump = generateDumpLike(5000);
      const { value, ms } = timed(() =>
        sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS)
      );

      expect(ms).toBeLessThan(BUDGET_MS);
      expect(value.stats).toEqual({
        tables: 5000,
        indexes: 10_000,
        indexBackedConstraints: 10_000,
        sequences: 5000,
        views: 500,
        materializedViews: 0,
      });
      expect(
        requiredMaxLocksPerTransaction(estimateRelations(value.stats))
      ).toBe(512);
    }
  );
});
