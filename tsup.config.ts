import { defineConfig } from 'tsup';

export default defineConfig([
  // src esm
  {
    entry: ['src/index.ts'],
    outDir: 'dist/esm',
    clean: true,
    format: 'esm',
    target: ['es2022', 'node18'],
    dts: false,
    minify: false,
    sourcemap: false,
    bundle: true,
    outExtension: () => ({ js: '.mjs' }),
  },
  // src cjs
  {
    entry: ['src/**/*.ts'],
    outDir: 'dist',
    clean: false,
    format: 'cjs',
    target: ['es2020', 'node16'],
    dts: false,
    minify: false,
    sourcemap: false,
    bundle: false,
  },
]);
