import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/node-pg-migrate.ts'],
  outDir: 'bin',
  clean: false,
  format: 'esm',
  target: ['es2023', 'node20'],
  dts: false,
  minify: false,
  sourcemap: false,
  bundle: false,
});
