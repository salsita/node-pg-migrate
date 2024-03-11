import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'json-summary', 'json', 'lcov', 'text'],
      include: ['src'],
      reportOnFailure: true,
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 84,
      },
    },
    reporters: process.env.CI_PREFLIGHT
      ? ['basic', 'github-actions']
      : ['basic'],
  },
});
