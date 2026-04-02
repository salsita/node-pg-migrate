import { defineConfig } from 'tsdown';

export default defineConfig([
  // build the executable
  {
    entry: ['bin/node-pg-migrate.ts'],
    outDir: 'bin',
    clean: false,
    format: ['esm'],
    dts: false,
    minify: false,
    sourcemap: false,
    unbundle: true,
    fixedExtension: false,
  },
  {
    entry: ['src/index.ts'],
    outDir: 'dist/bundle',
    clean: true,
    format: ['esm'],
    dts: true,
    minify: false,
    sourcemap: false,
    fixedExtension: false,
  },
  {
    entry: ['src/**/*'],
    dts: true,
    clean: true,
    unbundle: true,
    format: ['esm'],
    outDir: 'dist/legacy',
    fixedExtension: false,
  },
]);
