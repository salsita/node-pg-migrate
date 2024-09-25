import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  clean: true,
  format: ['esm', 'cjs'],
  target: ['es2022', 'node18'],
  dts: false,
  minify: true,
  sourcemap: false,
  splitting: true,
});
