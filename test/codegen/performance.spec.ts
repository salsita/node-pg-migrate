import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { generateMigration } from '../../src/codegen';
import type { GenerateOptions } from '../../src/codegen/types';
import type { SchemaModel } from '../../src/introspect/types';
import { generatedModel } from './models';

// Performance guards: generous budgets and relative scaling only, so that
// they catch accidental quadratic work, not slow machines.

const OPTIONS: GenerateOptions = {
  language: 'ts',
  defaultSchema: 'public',
  migrationName: '1700000000000_baseline',
  fakeCommand: 'node-pg-migrate up 1700000000000_baseline --fake',
  source: { serverVersion: '18.6' },
};

function timed(model: SchemaModel): number {
  const start = performance.now();
  generateMigration(model, OPTIONS);

  return performance.now() - start;
}

function median(values: ReadonlyArray<number>): number {
  const sorted = values.toSorted((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

function medianOfFive(model: SchemaModel): number {
  timed(model);

  return median(Array.from({ length: 5 }, () => timed(model)));
}

describe('generateMigration', () => {
  it(
    'performance: orders, emits and renders a 5,000-table model within 5 s',
    { retry: 2, timeout: 120_000 },
    () => {
      const model = generatedModel(5000);

      expect(timed(model)).toBeLessThan(5000);
    }
  );

  it(
    'performance: takes time linear in the size of the model',
    { retry: 2, timeout: 300_000 },
    () => {
      const small = medianOfFive(generatedModel(1000));
      const large = medianOfFive(generatedModel(4000));

      expect(large / small).toBeLessThan(8);
    }
  );
});
