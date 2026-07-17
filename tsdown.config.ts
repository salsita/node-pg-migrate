import { defineConfig } from 'tsdown';

export default defineConfig([
  // build the executable
  // Source lives in src/cli.ts but is emitted as bin/node-pg-migrate.js to keep
  // the published `bin` path (and `node bin/node-pg-migrate.js`) stable.
  {
    entry: { 'node-pg-migrate': 'src/cli.ts' },
    outDir: 'bin',
    clean: false,
    format: ['esm'],
    dts: false,
    minify: false,
    sourcemap: false,
    unbundle: true,
    fixedExtension: false,
  },
  // build the programmatic API as a single bundled entry point
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    clean: true,
    format: ['esm'],
    dts: true,
    minify: false,
    sourcemap: false,
    fixedExtension: false,
  },
]);
