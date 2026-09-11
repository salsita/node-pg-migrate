import { defineConfig } from 'vitest/config';

// The suite `--coverage` reports on: `unit` (default) or `integration`.
// The e2e suite runs the built CLI in child processes, which vitest coverage
// can't see; it has its own report, see test/e2e/report-coverage.mjs.
const coverageSuite = process.env.PGM_COVERAGE_SUITE ?? 'unit';
if (coverageSuite !== 'unit' && coverageSuite !== 'integration') {
  throw new Error(
    `PGM_COVERAGE_SUITE must be "unit" or "integration", got "${coverageSuite}"`
  );
}

// Code the integration suite owns (it needs a real database). The unit report
// leaves it out so the repo-wide unit thresholds only measure unit-tested code.
const integrationOwned = [
  'src/baseline/io/**',
  'src/baseline/index.ts',
  'src/introspect/io/**',
];

// Glob thresholds that match no file yet pass, so each one applies as soon
// as its files exist (untested files under `src` count as 0% covered).
const coverageThresholds = {
  // Keep the global unit thresholds first in this file: the PR coverage comment
  // (.github/workflows/coverage-report.yml) takes the first `lines:`,
  // `branches:`, … numbers it finds here.
  unit: {
    lines: 90,
    statements: 90,
    functions: 90,
    branches: 85,
    ...Object.fromEntries(
      ['src/baseline/core/**', 'src/introspect/core/**', 'src/codegen/**'].map(
        (glob) => [
          glob,
          { lines: 90, statements: 90, functions: 90, branches: 90 },
        ]
      )
    ),
  },
  integration: Object.fromEntries(
    integrationOwned.map((glob) => [
      glob,
      { lines: 90, statements: 90, functions: 90, branches: 90 },
    ])
  ),
};

// Each e2e test spawns the CLI several times against a real Postgres.
const e2eTimeout = Number(process.env.E2E_TIMEOUT ?? 180_000);

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/**/*.spec.ts'],
          exclude: ['test/integration/**/*', 'test/e2e/**/*'],
        },
      },
      {
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/e2e/**/*.spec.ts'],
          globalSetup: ['test/e2e/global-setup.ts'],
          testTimeout: e2eTimeout,
          hookTimeout: e2eTimeout,
          // One spec file at a time: every file starts a Postgres container
          // per version and spawns many CLI processes, so parallel files
          // overload Docker and CI runners and make the suite flaky.
          fileParallelism: false,
        },
      },
      {
        test: {
          // Benchmarks only (`pnpm run bench`): no tests, no coverage.
          name: 'bench',
          environment: 'node',
          include: [],
          benchmark: { include: ['test/bench/**/*.bench.ts'] },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'json-summary', 'json', 'lcov', 'text'],
      // `test:coverage` (used by .github/workflows/coverage.yml) sets no suite
      // and keeps writing to coverage/.
      reportsDirectory:
        process.env.PGM_COVERAGE_SUITE === undefined
          ? 'coverage'
          : `coverage/${coverageSuite}`,
      include: ['src'],
      exclude: [
        'src/operations/*Types.ts',
        // TODO @Shinigami92 2026-07-17: The CLI is exercised by the integration/CLI e2e jobs,
        // not the unit suite that feeds coverage. The e2e suite measures it
        // (`pnpm run test:coverage:e2e`, coverage/e2e).
        // Cover it once dedicated unit tests are added for src/cli/ in a follow-up PR.
        'src/cli/**',
        ...(coverageSuite === 'unit' ? integrationOwned : []),
      ],
      reportOnFailure: true,
      thresholds: coverageThresholds[coverageSuite],
    },
    reporters: process.env.CI_PREFLIGHT
      ? ['default', 'github-actions']
      : [['default', { summary: false }]],
  },
});
