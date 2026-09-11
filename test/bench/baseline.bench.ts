import { bench, describe } from 'vitest';
import {
  estimateRelations,
  requiredMaxLocksPerTransaction,
} from '../../src/baseline/core/locks';
import { sanitizeDump } from '../../src/baseline/core/sanitize';
import { scanTopLevel } from '../../src/baseline/core/scan';
import { DEFAULT_SANITIZE_OPTIONS } from '../baseline/helpers';
import { generateDumpLike } from '../fixtures/generate';

// `pnpm run bench`: how long the pure part of `baseline` takes on generated
// pg_dump output of a large (500 tables) and a very large (5,000 tables)
// schema. Not a test and not a CI gate: nothing here asserts on time.

/**
 * The schema sizes, in tables. `generateDumpLike()` writes about 2 KB of SQL
 * per table.
 */
const TABLE_COUNTS: ReadonlyArray<number> = [500, 5000];

const COUNT_FORMAT = new Intl.NumberFormat('en-US');

for (const tables of TABLE_COUNTS) {
  const dump = generateDumpLike(tables);
  const megabytes = (dump.length / 1_000_000).toFixed(1);

  describe(`${COUNT_FORMAT.format(tables)} tables (${megabytes} MB of pg_dump output)`, () => {
    bench('scanTopLevel', () => {
      scanTopLevel(dump);
    });

    bench('sanitizeDump', () => {
      sanitizeDump(dump, DEFAULT_SANITIZE_OPTIONS);
    });
  });
}

describe('max_locks_per_transaction estimate', () => {
  const largest = Math.max(...TABLE_COUNTS);
  const { stats } = sanitizeDump(
    generateDumpLike(largest),
    DEFAULT_SANITIZE_OPTIONS
  );

  bench(
    `estimateRelations + requiredMaxLocksPerTransaction (${COUNT_FORMAT.format(largest)} tables)`,
    () => {
      requiredMaxLocksPerTransaction(estimateRelations(stats));
    },
    // Constant time: a short run gives millions of samples already.
    { time: 50, warmupTime: 10 }
  );
});
