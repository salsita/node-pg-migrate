import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'json-summary', 'json', 'lcov', 'text'],
      include: ['src', 'bin'],
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
      ? ['basic', 'github-actions']
      : ['basic'],
  },
});
