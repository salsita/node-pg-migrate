import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['clover', 'cobertura', 'lcov', 'text'],
      include: ['src'],
    },
    reporters: process.env.CI_PREFLIGHT
      ? ['basic', 'github-actions']
      : ['basic'],
  },
});
