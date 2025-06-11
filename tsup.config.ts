import { fixExtensionsPlugin } from 'esbuild-fix-imports-plugin';
import { defineConfig } from 'tsup';

export default defineConfig([
  // build the executeable
  {
    entry: ['bin/node-pg-migrate.ts'],
    outDir: 'bin',
    clean: false,
    format: ['esm'],
    target: ['node20.11'],
    dts: false,
    minify: false,
    sourcemap: false,
    bundle: false,
  },
  {
    entry: ['src/index.ts'],
    outDir: 'dist/bundle',
    clean: true,
    format: ['esm'],
    target: ['node20.11'],
    dts: true,
    minify: false,
    sourcemap: false,
    bundle: true,
  },
  {
    entry: ['src/**/*'],
    target: ['node20.11'],
    dts: true,
    clean: true,
    bundle: false, // Important: set to false
    format: ['esm'],
    outDir: 'dist/legacy',
    esbuildPlugins: [fixExtensionsPlugin()],
  },
]);
