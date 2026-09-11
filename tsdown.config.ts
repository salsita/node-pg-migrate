import { defineConfig } from 'tsdown';

// Source maps are opt-in (`PGM_SOURCEMAP=1 pnpm run build`): the e2e coverage
// report (test/e2e/report-coverage.mjs) needs them to map the V8 coverage of the
// spawned CLI back to src/. Published builds stay without maps.
const sourcemap = process.env.PGM_SOURCEMAP === '1';

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
    sourcemap,
    fixedExtension: false,
    // The CLI self-references the library by package name (see src/cli/config.ts)
    // so the emitted bin/ file resolves it through the `exports` map at runtime.
    // It lives in devDependencies (`link:.`), which tsdown does not
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
    sourcemap,
    fixedExtension: false,
  },
]);
