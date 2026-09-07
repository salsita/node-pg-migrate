import { defineConfig } from 'tsdown';

export default defineConfig([
  // build the executable
  // Source lives in the src/cli/ module (entry: src/cli/index.ts) but the whole
  // module is bundled into a single bin/node-pg-migrate.js to keep the published
  // `bin` path (and `node bin/node-pg-migrate.js`) stable.
  {
    entry: { 'node-pg-migrate': 'src/cli/index.ts' },
    outDir: 'bin',
    clean: false,
    format: ['esm'],
    dts: false,
    minify: false,
    sourcemap: false,
    fixedExtension: false,
    // The CLI self-references the library by package name (see src/cli/config.ts)
    // so the emitted bin/ file resolves it through the `exports` map at runtime.
    // It lives in devDependencies (`file:.`), which tsdown does not
    // auto-externalize, so keep it out of the bundle explicitly to silence the
    // UNRESOLVED_IMPORT warning.
    deps: { neverBundle: ['node-pg-migrate'] },
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
