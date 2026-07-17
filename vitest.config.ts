import { defineConfig } from 'vitest/config';

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
          exclude: ['test/integration/**/*'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'json-summary', 'json', 'lcov', 'text'],
      include: ['src'],
      exclude: [
        'src/operations/*Types.ts',
        // TODO @Shinigami92 2026-07-17: The CLI is exercised by the integration/CLI e2e jobs,
        // not the unit suite that feeds coverage.
        // Cover it once it is split into smaller units under src/cli/ in a follow-up PR.
        'src/cli.ts',
      ],
      reportOnFailure: true,
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
    reporters: process.env.CI_PREFLIGHT
      ? ['default', 'github-actions']
      : [['default', { summary: false }]],
  },
});
