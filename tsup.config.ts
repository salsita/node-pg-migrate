import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts'],
  outDir: 'dist',
  clean: true,
  format: ['esm', 'cjs'],
  target: ['es2020', 'node16'],
  dts: false,
  minify: false,
  splitting: true,
  bundle: false,
});
