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
    // Exclude cli.ts — it is not part of the public library surface and is
    // emitted separately as the bin executable above.
    entry: ['src/**/*', '!src/cli.ts'],
    dts: true,
    clean: true,
    unbundle: true,
    format: ['esm'],
    outDir: 'dist/legacy',
    fixedExtension: false,
  },
]);
