// Reports the e2e coverage of the built CLI and enforces its gate.
//
// With PGM_E2E_COVERAGE=1, every CLI process that `runCli` (test/e2e/utils.ts)
// starts writes raw V8 coverage to coverage/e2e/raw. This script maps it back
// to src/ through the source maps of a `PGM_SOURCEMAP=1 pnpm run build`, writes
// coverage/e2e/lcov.info, and fails when the mapping didn't work or the files
// the e2e suite owns are below the threshold.
//
// It uses monocart-coverage-reports rather than c8, which reports these
// rolldown bundles as 100% covered with 0 functions.
import { CoverageReport } from 'monocart-coverage-reports';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../..');
const OUTPUT_DIR = resolve(ROOT, 'coverage/e2e');
// Same directory as RAW_COVERAGE_DIR in test/e2e/utils.ts.
const RAW_COVERAGE_DIR = resolve(OUTPUT_DIR, 'raw');
const BUNDLES = ['bin/node-pg-migrate.js', 'dist/index.js'];

// Path prefixes of the files the e2e suite owns. Their total must reach
// THRESHOLD percent for every metric.
const OWNED = [
  'src/cli/baseline.ts',
  'src/baseline/index.ts',
  'src/baseline/io/',
  'src/introspect/io/',
];
const THRESHOLD = 90;
const METRICS = ['lines', 'statements', 'functions', 'branches'];

/**
 * @param {number} covered
 * @param {number} total
 * @returns {string} e.g. `9/10 (90%)`, rounded down like istanbul does.
 */
function formatMetric(covered, total) {
  const pct = total === 0 ? 100 : Math.floor((covered / total) * 10_000) / 100;
  return `${covered}/${total} (${pct}%)`;
}

/**
 * @param {ReadonlyArray<{ metric: string, covered: number, total: number }>} counts
 * @returns {string} e.g. `lines 9/10 (90%), branches 1/2 (50%)`.
 */
function formatCounts(counts) {
  return counts
    .map(
      ({ metric, covered, total }) =>
        `${metric} ${formatMetric(covered, total)}`
    )
    .join(', ');
}

/**
 * Generates the report and checks it.
 *
 * @returns {Promise<string[]>} Why the check failed; empty when it passed.
 */
async function report() {
  if (
    !existsSync(RAW_COVERAGE_DIR) ||
    readdirSync(RAW_COVERAGE_DIR).length === 0
  ) {
    return [
      `No raw coverage in ${RAW_COVERAGE_DIR}: run the e2e tests with PGM_E2E_COVERAGE=1 first.`,
    ];
  }

  // monocart only follows the bundle's sourceMappingURL comment. A plain build
  // has none, even when a stale .map from an earlier build is still there.
  const unmapped = BUNDLES.filter((bundle) => {
    const path = resolve(ROOT, bundle);
    return (
      !existsSync(path) ||
      !readFileSync(path, 'utf8').includes('\n//# sourceMappingURL=')
    );
  });
  if (unmapped.length > 0) {
    return [
      `No source map for ${unmapped.join(' and ')}: build with PGM_SOURCEMAP=1 pnpm run build and run the e2e tests again.`,
    ];
  }

  const bundleUrls = new Set(
    BUNDLES.map((bundle) => pathToFileURL(resolve(ROOT, bundle)).href)
  );
  const coverageReport = new CoverageReport({
    name: 'node-pg-migrate e2e',
    outputDir: OUTPUT_DIR,
    baseDir: ROOT,
    reports: ['lcovonly', 'text-summary'],
    entryFilter: (entry) => bundleUrls.has(entry.url),
    sourceFilter: (sourcePath) => sourcePath.startsWith('src/'),
    // By default monocart empties OUTPUT_DIR, raw/ included. Keep the raw
    // coverage and only drop the cache that an interrupted run left behind.
    clean: false,
    cleanCache: true,
  });
  await coverageReport.addFromDir(RAW_COVERAGE_DIR);
  console.log('All of src/ that the CLI loaded (for information):');
  const results = await coverageReport.generate();
  const files = results?.files ?? [];

  const failures = [];

  // When the source maps don't match, the CLI entry point is missing or has
  // no functions.
  const entryPoint = files.find(
    (file) => file.sourcePath === 'src/cli/index.ts'
  );
  if (entryPoint === undefined || entryPoint.summary.functions.total === 0) {
    failures.push(
      'src/cli/index.ts is missing or has no functions: do the source maps in bin/ and dist/ belong to the build the tests ran?'
    );
  } else {
    const { covered, total } = entryPoint.summary.functions;
    console.log(`src/cli/index.ts functions: ${formatMetric(covered, total)}`);
  }

  const owned = files.filter((file) =>
    OWNED.some((prefix) => file.sourcePath.startsWith(prefix))
  );
  console.log(`Owned by the e2e suite (${THRESHOLD}% of their total):`);
  if (owned.length === 0) {
    console.log(`  none yet (${OWNED.join(', ')})`);
  }

  for (const file of owned) {
    const counts = METRICS.map((metric) => ({
      metric,
      covered: file.summary[metric].covered,
      total: file.summary[metric].total,
    }));
    console.log(`  ${file.sourcePath}: ${formatCounts(counts)}`);
  }

  const totals = METRICS.map((metric) => {
    let covered = 0;
    let total = 0;
    for (const file of owned) {
      covered += file.summary[metric].covered;
      total += file.summary[metric].total;
    }

    return { metric, covered, total };
  });
  if (owned.length > 0) {
    console.log(`  total: ${formatCounts(totals)}`);
  }

  for (const { metric, covered, total } of totals) {
    if (total > 0 && (covered / total) * 100 < THRESHOLD) {
      failures.push(
        `${metric} of the files owned by the e2e suite: ${formatMetric(covered, total)} is below ${THRESHOLD}%`
      );
    }
  }

  return failures;
}

const failures = await report();
for (const failure of failures) {
  console.error(`ERROR: ${failure}`);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
