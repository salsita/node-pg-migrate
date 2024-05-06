import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/node-pg-migrate.ts'],
  outDir: 'bin',
  clean: false,
  format: ['esm', 'cjs'],
  target: ['es2020', 'node16'],
  dts: false,
  minify: false,
  sourcemap: false,
  bundle: false,
});
