import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'test/integration/**/*.test.{ts,js}',
            'test/integration/**/*.spec.{ts,js}',
          ],
        },
      },
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/**/*.test.{ts,js}', 'test/**/*.spec.{ts,js}'],
          exclude: ['test/integration/**/*'],
        },
      },
    ],
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'json-summary', 'json', 'lcov', 'text'],
      include: [
        'src',
        // TODO @Shinigami92 2024-04-02: Add 'bin' folder in another PR
        //'bin'
      ],
      exclude: ['src/operations/*Types.ts'],
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
